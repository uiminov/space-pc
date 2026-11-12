"use server";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkPassword, createSession, destroySession, requireAdmin } from "@/lib/auth";
import { db, tx, UPLOADS_DIR } from "@/lib/db";
import { DEFAULT_SETTINGS, getSettings, refreshCbuRate, setSettings, type Settings } from "@/lib/settings";
import { applyImport, parsePriceFile, type Mapping } from "@/lib/priceImport";
import { CATEGORIES, ORDER_STATUSES, SPEC_FIELDS } from "@/lib/catalog";
import { slugify } from "@/lib/format";
import { notifyTelegram } from "@/lib/telegram";
import { downloadImage, findAndSaveImage, saveImageBuffer } from "@/lib/images";
import { cleanName, detectBrand, guessSpecs, isConfigurable } from "@/lib/partInfo";
import { guessCategory } from "@/lib/catalog";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (v: string) => {
  if (!v) return null;
  const n = parseFloat(v.replace(/\s/g, "").replace(",", "."));
  return isFinite(n) ? n : null;
};
const refresh = () => revalidatePath("/", "layout");

// ---------- Авторизация ----------

export async function login(_prev: { error?: string } | undefined, fd: FormData) {
  await new Promise((r) => setTimeout(r, 400)); // небольшая задержка против перебора
  if (!checkPassword(str(fd, "password"))) return { error: "Неверный пароль" };
  await createSession();
  redirect("/admin");
}

export async function logout() {
  await destroySession();
  redirect("/admin/login");
}

// ---------- Изображения ----------

async function saveImage(file: File | null): Promise<string | null> {
  if (!file || !file.size) return null;
  const ext = path.extname(file.name).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) throw new Error("Допустимы JPG, PNG, WEBP, AVIF");
  if (file.size > 8 * 1024 * 1024) throw new Error("Файл больше 8 МБ");
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/${name}`;
}

// Фото товара: тот же формат, что у найденных автоматически (квадрат, белый фон, одинаковые поля),
// чтобы загруженное вручную фото не выбивалось из сетки карточек
async function saveProductImage(file: File | null): Promise<string | null> {
  if (!file || !file.size) return null;
  const ext = path.extname(file.name).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(ext)) throw new Error("Допустимы JPG, PNG, WEBP, AVIF");
  if (file.size > 8 * 1024 * 1024) throw new Error("Файл больше 8 МБ");
  return saveImageBuffer(Buffer.from(await file.arrayBuffer()));
}

// Поиск фото в открытом каталоге Icecat по бренду и артикулу
export async function findImageIcecat(brand: string, code: string): Promise<{ url?: string; title?: string; error?: string }> {
  await requireAdmin();
  if (!brand.trim() || !code.trim()) return { error: "Укажите бренд и артикул (код производителя)" };
  const codes = [...new Set([code.trim(), code.split(/[\s/|]+/)[0]].filter(Boolean))];
  for (const c of codes) {
    try {
      const r = await fetch(
        `https://live.icecat.biz/api/?UserName=openIcecat-live&Language=ru&Brand=${encodeURIComponent(brand.trim())}&ProductCode=${encodeURIComponent(c)}`,
        { signal: AbortSignal.timeout(15000) },
      );
      const j = (await r.json()) as { data?: { Image?: { HighPic?: string; Pic500x500?: string }; GeneralInfo?: { Title?: string } } };
      const img = j.data?.Image?.HighPic || j.data?.Image?.Pic500x500;
      if (img) return { url: img, title: j.data?.GeneralInfo?.Title };
    } catch {}
  }
  return { error: "В открытом каталоге Icecat фото не найдено. Загрузите файл или вставьте ссылку с сайта производителя." };
}

// ---------- Сборки ----------

export type SaveState = { error?: string; ok?: string } | undefined;

export async function saveBuild(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireAdmin();
  const id = Number(str(fd, "id")) || null;
  const name = str(fd, "name");
  if (!name) return { error: "Укажите название" };
  let slug = slugify(str(fd, "slug") || name) || `build-${Date.now()}`;
  const clash = db().prepare("SELECT id FROM builds WHERE slug = ? AND id IS NOT ?").get(slug, id) as { id: number } | undefined;
  if (clash) slug = `${slug}-${Date.now().toString(36)}`;

  let items: { component_id: number; qty: number }[] = [];
  try {
    items = (JSON.parse(str(fd, "items") || "[]") as { component_id: number; qty: number }[])
      .map((i) => ({ component_id: Number(i.component_id), qty: Math.max(1, Math.min(8, Number(i.qty) || 1)) }))
      .filter((i) => i.component_id);
  } catch {
    return { error: "Ошибка в списке комплектующих" };
  }

  let image: string | null;
  try {
    image = await saveImage(fd.get("image") as File | null);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const removeImage = fd.get("remove_image") === "1";

  const vals = {
    slug,
    name,
    tagline: str(fd, "tagline") || null,
    description: str(fd, "description") || null,
    purpose: str(fd, "purpose") || "gaming",
    markup_percent: numOrNull(str(fd, "markup_percent")),
    assembly_fee: numOrNull(str(fd, "assembly_fee")),
    extra_price: numOrNull(str(fd, "extra_price")) ?? 0,
    fps: str(fd, "fps") || null,
    featured: fd.get("featured") ? 1 : 0,
    active: fd.get("active") ? 1 : 0,
    sort: Number(str(fd, "sort")) || 100,
    name_uz: str(fd, "name_uz") || null,
    tagline_uz: str(fd, "tagline_uz") || null,
    description_uz: str(fd, "description_uz") || null,
    fps_uz: str(fd, "fps_uz") || null,
  };

  const newId = tx(() => {
    const d = db();
    let bid = id;
    if (bid) {
      d.prepare(
        `UPDATE builds SET slug=?, name=?, tagline=?, description=?, purpose=?, markup_percent=?, assembly_fee=?,
         extra_price=?, fps=?, featured=?, active=?, sort=?, name_uz=?, tagline_uz=?, description_uz=?, fps_uz=? WHERE id=?`,
      ).run(...Object.values(vals), bid);
    } else {
      const r = d
        .prepare(
          `INSERT INTO builds(slug, name, tagline, description, purpose, markup_percent, assembly_fee, extra_price, fps, featured, active, sort, name_uz, tagline_uz, description_uz, fps_uz)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(...Object.values(vals));
      bid = Number(r.lastInsertRowid);
    }
    if (image) d.prepare("UPDATE builds SET image = ? WHERE id = ?").run(image, bid);
    else if (removeImage) d.prepare("UPDATE builds SET image = NULL WHERE id = ?").run(bid);
    d.prepare("DELETE FROM build_items WHERE build_id = ?").run(bid);
    const ins = d.prepare(
      "INSERT INTO build_items(build_id, component_id, qty) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET qty = qty + excluded.qty",
    );
    for (const it of items) ins.run(bid, it.component_id, it.qty);
    return bid!;
  });
  refresh();
  if (!id) redirect(`/admin/builds/${newId}?saved=1`);
  return { ok: "Сохранено" };
}

export async function deleteBuild(fd: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM builds WHERE id = ?").run(Number(fd.get("id")));
  refresh();
  redirect("/admin/builds");
}

export async function duplicateBuild(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const newId = tx(() => {
    const d = db();
    const b = d.prepare("SELECT * FROM builds WHERE id = ?").get(id) as Record<string, string | number | null>;
    const r = d
      .prepare(
        `INSERT INTO builds(slug, name, tagline, description, purpose, image, markup_percent, assembly_fee, extra_price, fps, featured, active, sort, name_uz, tagline_uz, description_uz, fps_uz)
         VALUES (?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,?,?)`,
      )
      .run(`${b.slug}-copy-${Date.now().toString(36)}`, `${b.name} (копия)`, b.tagline, b.description, b.purpose, b.image, b.markup_percent, b.assembly_fee, b.extra_price, b.fps, b.sort, b.name_uz ? `${b.name_uz} (nusxa)` : null, b.tagline_uz, b.description_uz, b.fps_uz);
    const nid = Number(r.lastInsertRowid);
    d.prepare("INSERT INTO build_items(build_id, component_id, qty) SELECT ?, component_id, qty FROM build_items WHERE build_id = ?").run(nid, id);
    return nid;
  });
  refresh();
  redirect(`/admin/builds/${newId}`);
}

// ---------- Комплектующие ----------

export async function saveComponent(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireAdmin();
  const id = Number(str(fd, "id")) || null;
  const category = str(fd, "category");
  const name = str(fd, "name");
  if (!CATEGORIES.some((c) => c.key === category)) return { error: "Выберите категорию" };
  if (!name) return { error: "Укажите название" };
  const specs: Record<string, string> = {};
  for (const f of SPEC_FIELDS[category] ?? []) {
    const v = str(fd, `spec_${f.key}`);
    if (v) specs[f.key] = v;
  }
  let image: string | null | undefined;
  try {
    image = await saveProductImage(fd.get("image_file") as File | null);
    if (!image && str(fd, "image_url")) image = await downloadImage(str(fd, "image_url"));
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (fd.get("remove_image") === "1") image = null;
  const vals = [
    category,
    name,
    str(fd, "brand") || null,
    str(fd, "price_code") || null,
    numOrNull(str(fd, "manual_price")),
    JSON.stringify(specs),
    fd.get("active") ? 1 : 0,
  ];
  let newId = id;
  if (id) {
    db().prepare("UPDATE components SET category=?, name=?, brand=?, price_code=?, manual_price=?, specs=?, active=? WHERE id=?").run(...vals, id);
  } else {
    const r = db()
      .prepare("INSERT INTO components(category, name, brand, price_code, manual_price, specs, active) VALUES (?,?,?,?,?,?,?)")
      .run(...vals);
    newId = Number(r.lastInsertRowid);
  }
  if (image !== undefined) db().prepare("UPDATE components SET image = ? WHERE id = ?").run(image, newId);
  refresh();
  if (!id) redirect(`/admin/components/${newId}?saved=1`);
  return { ok: "Сохранено" };
}

export async function deleteComponent(fd: FormData) {
  await requireAdmin();
  const id = Number(fd.get("id"));
  const used = db().prepare("SELECT COUNT(*) AS c FROM build_items WHERE component_id = ?").get(id) as { c: number };
  if (used.c > 0) {
    // компонент используется — просто скрываем
    db().prepare("UPDATE components SET active = 0 WHERE id = ?").run(id);
  } else {
    db().prepare("DELETE FROM components WHERE id = ?").run(id);
  }
  refresh();
  redirect("/admin/components");
}

export async function searchPriceItems(q: string) {
  await requireAdmin();
  const term = q.trim();
  if (term.length < 2) return [];
  const words = term.split(/\s+/).slice(0, 5);
  const where = words.map(() => "(name LIKE ? OR code LIKE ?)").join(" AND ");
  const args = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
  return db()
    .prepare(`SELECT code, name, price, in_stock, category FROM price_items WHERE ${where} ORDER BY in_stock DESC, name LIMIT 30`)
    .all(...args) as { code: string; name: string; price: number; in_stock: number; category: string | null }[];
}

// ---------- Массовые операции ----------

// Добавить на сайт все комплектующие ПК из прайса, которые есть в наличии и ещё не добавлены
export async function bulkAddFromPrice(): Promise<{ added: number; byCategory: Record<string, number> }> {
  await requireAdmin();
  const d = db();
  const items = d
    .prepare(
      `SELECT p.code, p.name FROM price_items p
       WHERE p.supplier = 'age' AND p.in_stock = 1 AND p.price > 0 AND NOT EXISTS (SELECT 1 FROM component_offers o WHERE o.price_code = p.code)`,
    )
    .all() as { code: string; name: string }[];
  const ins = d.prepare("INSERT INTO components(category, name, brand, price_code, specs) VALUES (?, ?, ?, ?, ?)");
  const byCategory: Record<string, number> = {};
  let added = 0;
  tx(() => {
    for (const it of items) {
      const cat = guessCategory(it.name);
      if (!isConfigurable(cat, it.name)) continue;
      ins.run(cat, cleanName(it.name), detectBrand(it.name), it.code, JSON.stringify(guessSpecs(cat, it.name)));
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      added++;
    }
  });
  refresh();
  return { added, byCategory };
}

// Автопоиск фото: обрабатывает порцию комплектующих без фото, клиент вызывает повторно до конца
export async function autoFindImages(): Promise<{ processed: number; found: number; remaining: number; sources: Record<string, number> }> {
  await requireAdmin();
  const d = db();
  const batch = d
    .prepare(
      `SELECT c.id, c.category, c.name, c.brand, c.price_code, p.name AS pname FROM components c
       LEFT JOIN price_items p ON p.code = c.price_code
       WHERE c.image IS NULL AND c.image_checked = 0 ORDER BY c.id LIMIT 12`,
    )
    .all() as { id: number; category: string; name: string; brand: string | null; price_code: string | null; pname: string | null }[];
  let found = 0;
  const sources: Record<string, number> = {};
  const upd = d.prepare("UPDATE components SET image = ?, image_checked = 1 WHERE id = ?");
  const mark = d.prepare("UPDATE components SET image_checked = 1 WHERE id = ?");
  await Promise.all(
    batch.map(async (c) => {
      const name = c.pname || c.name;
      try {
        const r = await findAndSaveImage({ brand: c.brand || detectBrand(name), code: c.price_code, name, category: c.category });
        if (r) {
          upd.run(r.path, c.id);
          found++;
          sources[r.source] = (sources[r.source] || 0) + 1;
          return;
        }
      } catch (e) {
        console.error("image search failed", c.name, (e as Error).message);
      }
      mark.run(c.id);
    }),
  );
  const remaining = (d.prepare("SELECT COUNT(*) AS n FROM components WHERE image IS NULL AND image_checked = 0").get() as { n: number }).n;
  if (!remaining) refresh();
  return { processed: batch.length, found, remaining, sources };
}

export async function resetImageChecks() {
  await requireAdmin();
  db().prepare("UPDATE components SET image_checked = 0 WHERE image IS NULL").run();
}

// ---------- Прайс ----------

export type ImportState =
  | {
      error?: string;
      result?: {
        filename: string;
        headerRow: number;
        columns: Record<string, string | null>;
        total: number;
        created: number;
        updated: number;
        missing: number;
        skipped: number;
        sample: { code: string; name: string; price: number; inStock: boolean; category: string | null }[];
        dryRun: boolean;
      };
    }
  | undefined;

export async function importPrices(_prev: ImportState, fd: FormData): Promise<ImportState> {
  await requireAdmin();
  const file = fd.get("file") as File | null;
  if (!file || !file.size) return { error: "Выберите файл прайса (.xlsx или .csv)" };
  const mapping: Mapping = {
    code: str(fd, "col_code"),
    name: str(fd, "col_name"),
    price: str(fd, "col_price"),
    stock: str(fd, "col_stock"),
    category: str(fd, "col_category"),
  };
  const missingMode = str(fd, "missing_mode") || "out_of_stock";
  const dryRun = fd.get("dry_run") === "1";
  setSettings({
    import_col_code: mapping.code,
    import_col_name: mapping.name,
    import_col_price: mapping.price,
    import_col_stock: mapping.stock,
    import_col_category: mapping.category,
    import_missing_mode: missingMode,
  });
  try {
    const parsed = await parsePriceFile(file, mapping);
    if (!parsed.rows.length) return { error: "В файле не найдено ни одной позиции с ценой" };
    let stats = { total: parsed.rows.length, created: 0, updated: 0, missing: 0 };
    if (!dryRun) {
      stats = applyImport(parsed, missingMode);
      refresh();
    }
    return {
      result: {
        filename: parsed.filename,
        headerRow: parsed.headerRow,
        columns: parsed.columns,
        skipped: parsed.skipped,
        sample: parsed.rows.slice(0, 15).map((r) => ({ code: r.code, name: r.name, price: r.price, inStock: r.inStock, category: r.category })),
        dryRun,
        ...stats,
      },
    };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function createComponentFromPrice(fd: FormData) {
  await requireAdmin();
  const code = str(fd, "code");
  const category = str(fd, "category");
  const p = db().prepare("SELECT * FROM price_items WHERE code = ?").get(code) as { name: string } | undefined;
  if (!p) return;
  const exists = db().prepare("SELECT component_id AS id FROM component_offers WHERE price_code = ?").get(code) as { id: number } | undefined;
  if (exists) redirect(`/admin/components/${exists.id}`);
  const r = db()
    .prepare("INSERT INTO components(category, name, brand, price_code, specs) VALUES (?, ?, ?, ?, ?)")
    .run(
      CATEGORIES.some((c) => c.key === category) ? category : "other",
      cleanName(p.name),
      detectBrand(p.name),
      code,
      JSON.stringify(guessSpecs(category, p.name)),
    );
  refresh();
  redirect(`/admin/components/${Number(r.lastInsertRowid)}`);
}

// ---------- Заказы ----------

export async function setOrderStatus(fd: FormData) {
  await requireAdmin();
  const status = str(fd, "status");
  if (!ORDER_STATUSES.some((s) => s.key === status)) return;
  db().prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, Number(fd.get("id")));
  refresh();
}

export async function deleteOrder(fd: FormData) {
  await requireAdmin();
  db().prepare("DELETE FROM orders WHERE id = ?").run(Number(fd.get("id")));
  refresh();
}

// ---------- Настройки ----------

export async function saveSettings(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireAdmin();
  const vals: Partial<Settings> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (k.startsWith("import_") || k.startsWith("banner_") || k.startsWith("hero_") || k === "usd_rate_checked_at" || k === "usd_rate_date") continue;
    if (fd.has(k)) vals[k] = String(fd.getAll(k).at(-1) ?? "").trim(); // для чекбоксов берём последнее значение
  }
  setSettings(vals);
  refresh();
  return { ok: "Настройки сохранены" };
}

export async function updateRateFromCbu(): Promise<SaveState> {
  await requireAdmin();
  try {
    const { rate, date } = await refreshCbuRate();
    refresh();
    return { ok: `Курс ЦБ на ${date}: ${rate.toLocaleString("ru-RU")} сум` };
  } catch (e) {
    return { error: `Не удалось получить курс ЦБ: ${(e as Error).message}` };
  }
}

export async function testTelegram() {
  await requireAdmin();
  const s = getSettings();
  await notifyTelegram(`✅ Тестовое сообщение от сайта ${s.shop_name}. Уведомления о заказах настроены.`);
}

// ---------- Баннер и тексты главной ----------

const BANNER_KEYS = ["banner_title_uz", "banner_title_ru", "banner_text_uz", "banner_text_ru", "banner_btn_uz", "banner_btn_ru", "banner_link", "hero_sub_uz", "hero_sub_ru"] as const;

export async function saveBanner(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireAdmin();
  const vals: Partial<Settings> = { banner_on: fd.get("banner_on") ? "1" : "0" };
  for (const k of BANNER_KEYS) vals[k] = String(fd.get(k) ?? "").trim().slice(0, 600);
  const link = vals.banner_link ?? "";
  if (link && !/^(\/|https?:\/\/)/.test(link)) return { error: "Ссылка должна начинаться с / (страница сайта) или с https://" };
  try {
    const img = await saveImage(fd.get("banner_image") as File | null);
    if (img) vals.banner_image = img;
    else if (fd.get("remove_image") === "1") vals.banner_image = "";
  } catch (e) {
    return { error: (e as Error).message };
  }
  setSettings(vals);
  refresh();
  return { ok: "Сохранено" };
}

// ---------- Наценка по товарам ----------

function parseMarkup(raw: unknown): number | null | "bad" {
  const v = String(raw ?? "").trim().replace(",", ".").replace("%", "");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > -50 && n <= 500 ? n : "bad";
}

// Своя наценка одного товара (пусто — снова общая)
export async function setComponentMarkup(id: number, raw: string): Promise<SaveState> {
  await requireAdmin();
  const m = parseMarkup(raw);
  if (m === "bad") return { error: "Наценка — число от −50 до 500" };
  db().prepare("UPDATE components SET markup_percent = ? WHERE id = ?").run(m, id);
  refresh();
  return { ok: m == null ? "общая" : `${m}%` };
}

// Наценка сразу для всех товаров по текущему фильтру (категория, бренд, поиск)
export async function bulkMarkup(_prev: SaveState, fd: FormData): Promise<SaveState> {
  await requireAdmin();
  const reset = fd.get("reset") === "1";
  const m = reset ? null : parseMarkup(fd.get("markup"));
  if (m === "bad") return { error: "Наценка — число от −50 до 500" };
  if (!reset && m == null) return { error: "Укажите наценку в процентах" };
  const where: string[] = ["1 = 1"];
  const args: string[] = [];
  const cat = String(fd.get("cat") ?? "");
  const brand = String(fd.get("brand") ?? "");
  const q = String(fd.get("q") ?? "").trim();
  if (cat) {
    where.push("category = ?");
    args.push(cat);
  }
  if (brand) {
    where.push("brand = ?");
    args.push(brand);
  }
  if (q) {
    where.push("(name LIKE ? OR price_code LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  const r = db().prepare(`UPDATE components SET markup_percent = ? WHERE ${where.join(" AND ")}`).run(m, ...args);
  refresh();
  return { ok: reset ? `Сброшено к общей наценке: ${r.changes} шт.` : `Наценка ${m}% применена к ${r.changes} шт.` };
}
