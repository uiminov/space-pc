import "server-only";
import { db } from "./db";
import { getSettings, num, type Settings } from "./settings";
import { CATEGORIES, REQUIRED_CATEGORIES } from "./catalog";

export type PriceItem = {
  id: number;
  code: string;
  name: string;
  price: number;
  stock: string | null;
  in_stock: number;
  category: string | null;
  updated_at: string;
};

export type ComponentRow = {
  id: number;
  category: string;
  name: string;
  brand: string | null;
  price_code: string | null;
  manual_price: number | null;
  specs: Record<string, string>;
  image: string | null;
  active: number;
  markup_percent: number | null; // своя наценка товара, % (null — общая)
  // вычисляемые
  supplier_name: string | null;
  supplier_price: number | null; // в валюте прайса
  in_stock: boolean;
  cost: number | null; // себестоимость, сум
  retail: number | null; // цена для покупателя (с наценкой), сум
  price_source: "pricelist" | "manual" | "none";
};

export type BuildRow = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  purpose: string;
  image: string | null;
  markup_percent: number | null;
  assembly_fee: number | null;
  extra_price: number;
  fps: string | null;
  featured: number;
  active: number;
  sort: number;
  name_uz: string | null;
  tagline_uz: string | null;
  description_uz: string | null;
  fps_uz: string | null;
};

// Тексты сборки на нужном языке (если узбекский перевод пуст — показываем русский)
export function locBuild(b: BuildRow, lang: "uz" | "ru") {
  const pick = (uz: string | null, ru: string | null) => (lang === "uz" && uz?.trim() ? uz : ru) ?? null;
  return {
    name: pick(b.name_uz, b.name) ?? b.name,
    tagline: pick(b.tagline_uz, b.tagline),
    description: pick(b.description_uz, b.description),
    fps: pick(b.fps_uz, b.fps),
  };
}

export type BuildFull = BuildRow & {
  items: (ComponentRow & { qty: number })[];
  cost: number;
  price: number | null; // null — цену нельзя посчитать (нет позиции в прайсе)
  available: boolean;
  problems: string[];
  byCategory: Record<string, (ComponentRow & { qty: number })[]>;
};

type Pricing = {
  rate: number;
  markup: number;
  assembly: number;
  roundTo: number;
};

export function pricing(s: Settings = getSettings()): Pricing {
  return {
    rate: s.price_currency === "UZS" ? 1 : num(s.usd_rate, 12650),
    markup: num(s.markup_percent, 0),
    assembly: num(s.assembly_fee, 0),
    roundTo: Math.max(1, num(s.round_to, 1000)),
  };
}

export function roundUp(v: number, to: number) {
  return Math.ceil(v / to) * to;
}

const COMPONENT_SQL = `
  SELECT c.*, p.name AS supplier_name, p.price AS supplier_price, p.in_stock AS p_in_stock
  FROM components c
  LEFT JOIN price_items p ON p.code = c.price_code
`;

// Наценка товара: своя, если задана в админке, иначе — общая для этого вида продажи
export function markupOf(c: { markup_percent: number | null }, fallback: number) {
  return c.markup_percent ?? fallback;
}

function mapComponent(r: Record<string, unknown>, pr: Pricing, markup = pr.markup): ComponentRow {
  const own = (r.markup_percent as number | null) ?? null;
  const manual = r.manual_price as number | null;
  const supplier = r.supplier_price as number | null;
  let cost: number | null = null;
  let source: ComponentRow["price_source"] = "none";
  if (supplier != null && supplier > 0) {
    cost = supplier * pr.rate;
    source = "pricelist";
  } else if (manual != null && manual > 0) {
    cost = manual; // ручная цена указывается в сумах
    source = "manual";
  }
  const inStock = source === "manual" ? true : source === "pricelist" ? r.p_in_stock === 1 : false;
  return {
    id: r.id as number,
    category: r.category as string,
    name: r.name as string,
    brand: (r.brand as string) ?? null,
    price_code: (r.price_code as string) ?? null,
    manual_price: manual,
    specs: safeJson(r.specs as string),
    image: (r.image as string) ?? null,
    active: r.active as number,
    markup_percent: own,
    supplier_name: (r.supplier_name as string) ?? null,
    supplier_price: supplier,
    in_stock: inStock,
    cost,
    retail: cost == null ? null : roundUp(cost * (1 + (own ?? markup) / 100), 1000),
    price_source: source,
  };
}

function safeJson(s: string): Record<string, string> {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

export function listComponents(opts: { activeOnly?: boolean; category?: string; q?: string; brand?: string } = {}) {
  const pr = pricing();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.activeOnly) where.push("c.active = 1");
  if (opts.category) {
    where.push("c.category = ?");
    args.push(opts.category);
  }
  if (opts.q) {
    where.push("(c.name LIKE ? OR c.price_code LIKE ?)");
    args.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  if (opts.brand) {
    where.push("c.brand = ?");
    args.push(opts.brand);
  }
  const sql = COMPONENT_SQL + (where.length ? " WHERE " + where.join(" AND ") : "") + " ORDER BY c.category, c.name";
  const rows = db().prepare(sql).all(...args) as Record<string, unknown>[];
  const order = CATEGORIES.map((c) => c.key as string);
  return rows
    .map((r) => mapComponent(r, pr))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

export function getComponent(id: number) {
  const r = db().prepare(COMPONENT_SQL + " WHERE c.id = ?").get(id) as Record<string, unknown> | undefined;
  return r ? mapComponent(r, pricing()) : null;
}

function computeBuild(b: BuildRow, pr: Pricing): BuildFull {
  const markup = b.markup_percent ?? pr.markup;
  const assembly = b.assembly_fee ?? pr.assembly;
  const rows = db()
    .prepare(COMPONENT_SQL.replace("FROM components c", "FROM build_items bi JOIN components c ON c.id = bi.component_id").replace("SELECT c.*", "SELECT c.*, bi.qty AS qty") + " WHERE bi.build_id = ?")
    .all(b.id) as Record<string, unknown>[];
  const order = CATEGORIES.map((c) => c.key as string);
  const items = rows
    .map((r) => ({ ...mapComponent(r, pr, markup), qty: r.qty as number }))
    .sort((a, b2) => order.indexOf(a.category) - order.indexOf(b2.category));

  const problems: string[] = [];
  let cost = 0;
  let withMarkup = 0; // сумма деталей с наценкой (у каждой — своя или наценка сборки)
  let priced = true;
  let available = true;
  for (const it of items) {
    if (it.cost == null) {
      priced = false;
      problems.push(`Нет цены: ${it.name}${it.price_code ? ` (код ${it.price_code} не найден в прайсе)` : ""}`);
    } else {
      cost += it.cost * it.qty;
      withMarkup += it.cost * it.qty * (1 + markupOf(it, markup) / 100);
    }
    if (!it.in_stock) {
      available = false;
      if (it.cost != null) problems.push(`Нет в наличии у поставщика: ${it.name}`);
    }
  }
  const cats = new Set(items.map((i) => i.category));
  for (const req of REQUIRED_CATEGORIES) {
    if (!cats.has(req)) problems.push(`В сборке нет обязательной категории: ${CATEGORIES.find((c) => c.key === req)?.label}`);
  }
  const hasIgpu = items.some((i) => i.category === "cpu" && /^(да|yes|есть)/i.test(i.specs.igpu || ""));
  if (!cats.has("gpu") && !hasIgpu) problems.push("Нет видеокарты, а у процессора не указана встроенная графика");

  const price = priced && items.length ? roundUp(withMarkup + assembly + (b.extra_price || 0), pr.roundTo) : null;
  const byCategory: BuildFull["byCategory"] = {};
  for (const it of items) (byCategory[it.category] ||= []).push(it);
  return { ...b, items, cost, price, available: available && priced, problems, byCategory };
}

export function listBuilds(opts: { activeOnly?: boolean } = {}) {
  const pr = pricing();
  const rows = db()
    .prepare(`SELECT * FROM builds ${opts.activeOnly ? "WHERE active = 1" : ""} ORDER BY sort, id`)
    .all() as BuildRow[];
  return rows.map((b) => computeBuild(b, pr));
}

export function getBuildBySlug(slug: string) {
  const b = db().prepare("SELECT * FROM builds WHERE slug = ?").get(slug) as BuildRow | undefined;
  return b ? computeBuild(b, pricing()) : null;
}

export function getBuild(id: number) {
  const b = db().prepare("SELECT * FROM builds WHERE id = ?").get(id) as BuildRow | undefined;
  return b ? computeBuild(b, pricing()) : null;
}

export function gpuOf(b: BuildFull) {
  return b.byCategory.gpu?.[0]?.name ?? (b.byCategory.cpu?.[0] ? "Встроенная графика" : "—");
}
export function cpuOf(b: BuildFull) {
  return b.byCategory.cpu?.[0]?.name ?? "—";
}

// ---------- Продажа комплектующих по отдельности ----------

export function partsMarkup(s: Settings = getSettings()) {
  return s.parts_markup_percent.trim() === "" ? num(s.markup_percent, 0) : num(s.parts_markup_percent, 0);
}

export function partPrice(cost: number | null, markup: number) {
  return cost == null ? null : roundUp(cost * (1 + markup / 100), 1000);
}

export type PartQuery = {
  category?: string;
  q?: string;
  brand?: string;
  min?: number;
  max?: number;
  sort?: string;
  specs?: Record<string, string>;
};

// Товары для каталога: только активные, с ценой; цена — розничная для отдельной продажи
export function listParts(query: PartQuery) {
  const markup = partsMarkup();
  let items = listComponents({ activeOnly: true, category: query.category })
    .filter((c) => c.cost != null)
    .map((c) => ({ ...c, price: partPrice(c.cost, markupOf(c, markup))! }));
  const base = items;
  if (query.q) {
    const words = query.q.toLowerCase().split(/\s+/).filter(Boolean);
    items = items.filter((c) => words.every((w) => `${c.name} ${c.brand ?? ""}`.toLowerCase().includes(w)));
  }
  if (query.brand) items = items.filter((c) => c.brand === query.brand);
  if (query.min) items = items.filter((c) => c.price >= query.min!);
  if (query.max) items = items.filter((c) => c.price <= query.max!);
  for (const [k, v] of Object.entries(query.specs ?? {})) if (v) items = items.filter((c) => c.specs[k] === v);
  if (query.sort === "price_desc") items.sort((a, b) => b.price - a.price);
  else if (query.sort === "name") items.sort((a, b) => a.name.localeCompare(b.name));
  else items.sort((a, b) => Number(!a.image) - Number(!b.image) || a.price - b.price); // по умолчанию: с фото вперёд, дешевле вперёд
  return { items, base };
}

export function getPart(id: number) {
  const c = getComponent(id);
  if (!c || !c.active || c.cost == null) return null;
  return { ...c, price: partPrice(c.cost, markupOf(c, partsMarkup()))! };
}

export function installment(price: number, s: Settings = getSettings()) {
  const months = Math.max(1, num(s.installment_months, 12));
  const markup = num(s.installment_markup_percent, 0);
  return { months, monthly: Math.ceil((price * (1 + markup / 100)) / months / 1000) * 1000 };
}
