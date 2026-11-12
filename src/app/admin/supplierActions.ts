"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { readDarianFile } from "@/lib/priceImport";
import { applyDarian, decideMatch, type DarianResult } from "@/lib/darian";
import { resolveOffers, SUPPLIERS } from "@/lib/suppliers";

const refresh = () => revalidatePath("/", "layout");

export type DarianImportState = { error?: string; result?: DarianResult & { filename: string; dryRun: boolean } } | undefined;

// Загрузка прайса Darian из админки
export async function importDarian(_prev: DarianImportState, fd: FormData): Promise<DarianImportState> {
  await requireAdmin();
  const file = fd.get("file") as File | null;
  if (!file || !file.size) return { error: "Выберите файл прайса Darian (.xlsx)" };
  const dryRun = fd.get("dry_run") === "1";
  try {
    const rows = await readDarianFile(file);
    if (dryRun) {
      const priced = rows.filter((r) => r.price).length;
      return { result: { filename: file.name, dryRun, total: rows.length, priced, created: 0, updated: 0, missing: 0, added: 0, merged: 0, review: 0, skipped: 0 } };
    }
    const res = applyDarian(db(), rows, file.name);
    refresh();
    return { result: { ...res, filename: file.name, dryRun } };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// «Это один товар» / «Разные товары» для сомнительного совпадения
export async function resolveMatch(fd: FormData) {
  await requireAdmin();
  const code = String(fd.get("code") ?? "");
  const comp = fd.get("component_id");
  if (!code) return;
  decideMatch(db(), code, comp ? Number(comp) : null);
  refresh();
}

export type Suggestion = { key: string; title: string; suppliers: string[]; best: number | null; inStock: boolean };

// Подсказки для сравнения цен: товары всех прайсов по словам запроса. Одинаковые товары (связанные в одну
// карточку) — одной строкой. key: «#c<id товара>» или «#p<код позиции>» — по нему страница сравнения находит товар точно.
export async function suggestOffers(q: string): Promise<Suggestion[]> {
  await requireAdmin();
  const words = q.trim().split(/\s+/).filter((w) => w.length >= 2).slice(0, 6);
  if (!words.length) return [];
  const rows = db()
    .prepare(
      `SELECT p.code, p.name, p.price, p.in_stock, p.supplier,
              (SELECT MIN(component_id) FROM component_offers o WHERE o.price_code = p.code) AS cid
       FROM price_items p WHERE p.price > 0 AND ${words.map(() => "(p.name LIKE ? OR p.code LIKE ?)").join(" AND ")}
       ORDER BY p.in_stock DESC, p.price LIMIT 120`,
    )
    .all(...words.flatMap((w) => [`%${w}%`, `%${w}%`])) as { code: string; name: string; price: number; in_stock: number; supplier: string; cid: number | null }[];
  const groups = new Map<string, { key: string; names: string[]; suppliers: Set<string>; prices: number[]; inStock: boolean }>();
  for (const r of rows) {
    const key = r.cid != null ? `#c${r.cid}` : `#p${r.code}`;
    const g = groups.get(key) ?? { key, names: [], suppliers: new Set<string>(), prices: [], inStock: false };
    g.names.push(r.name);
    g.suppliers.add(r.supplier);
    if (r.in_stock) {
      g.prices.push(r.price);
      g.inStock = true;
    }
    groups.set(key, g);
  }
  // у связанных товаров — все поставщики, даже если название у второго не совпало с запросом
  const cids = [...groups.keys()].filter((k) => k.startsWith("#c")).map((k) => Number(k.slice(2)));
  if (cids.length) {
    const extra = db()
      .prepare(`SELECT o.component_id AS cid, p.supplier, p.price, p.in_stock FROM component_offers o JOIN price_items p ON p.code = o.price_code WHERE o.component_id IN (${cids.map(() => "?").join(",")})`)
      .all(...cids) as { cid: number; supplier: string; price: number; in_stock: number }[];
    for (const e of extra) {
      const g = groups.get(`#c${e.cid}`)!;
      g.suppliers.add(e.supplier);
      if (e.in_stock && e.price > 0) {
        g.prices.push(e.price);
        g.inStock = true;
      }
    }
  }
  return [...groups.values()]
    .map((g) => ({
      key: g.key,
      title: [...g.names].sort((a, b) => b.length - a.length)[0],
      suppliers: [...g.suppliers].map((s) => SUPPLIERS.find((x) => x.key === s)?.short ?? s),
      best: g.prices.length ? Math.min(...g.prices) : null,
      inStock: g.inStock,
    }))
    .sort((a, b) => b.suppliers.length - a.suppliers.length || Number(b.inStock) - Number(a.inStock) || (a.best ?? 1e9) - (b.best ?? 1e9))
    .slice(0, 12);
}

// Главный поставщик (у кого брать цену, если товар есть у нескольких)
export async function setMainSupplier(fd: FormData) {
  await requireAdmin();
  const main = String(fd.get("main") ?? "");
  if (!SUPPLIERS.some((s) => s.key === main)) return;
  const order = [main, ...SUPPLIERS.map((s) => s.key).filter((k) => k !== main)].join(",");
  const d = db();
  d.prepare("INSERT INTO settings(key, value) VALUES ('supplier_order', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(order);
  resolveOffers(d);
  refresh();
}

// Отвязать предложение поставщика от товара (если совпадение оказалось ошибочным)
export async function unlinkOffer(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("component_id"));
  const code = String(fd.get("code") ?? "");
  const d = db();
  const n = (d.prepare("SELECT COUNT(*) AS n FROM component_offers WHERE component_id = ?").get(id) as { n: number }).n;
  if (n <= 1) return; // последнее предложение не отвязываем — товар остался бы без цены
  d.prepare("DELETE FROM component_offers WHERE component_id = ? AND price_code = ?").run(id, code);
  // больше не предлагать эту пару автоматически
  d.prepare("INSERT INTO offer_matches(price_code, component_id, reason, status) VALUES (?, ?, 'отвязано вручную', 'rejected') ON CONFLICT DO UPDATE SET status = 'rejected'").run(code, id);
  const cur = d.prepare("SELECT price_code FROM components WHERE id = ?").get(id) as { price_code: string | null } | undefined;
  if (cur?.price_code === code) {
    const other = d.prepare("SELECT price_code FROM component_offers WHERE component_id = ? LIMIT 1").get(id) as { price_code: string };
    d.prepare("UPDATE components SET price_code = ? WHERE id = ?").run(other.price_code, id);
  }
  resolveOffers(d);
  refresh();
}
