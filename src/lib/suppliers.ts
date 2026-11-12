import type { DatabaseSync } from "node:sqlite";

// Поставщики. Позиции прайса лежат в одной таблице price_items, поле supplier — чей прайс.
// Коды позиций AGE хранятся как есть (так было до появления второго поставщика),
// коды остальных — с приставкой «darian:…», чтобы коды разных прайсов не пересекались.
export const SUPPLIERS = [
  { key: "age", name: "AGE UZ", short: "AGE" },
  { key: "darian", name: "Darian", short: "Darian" },
] as const;
export type SupplierKey = (typeof SUPPLIERS)[number]["key"];

export function supplierName(key: string) {
  return SUPPLIERS.find((s) => s.key === key)?.short ?? key;
}

export function prefixed(supplier: SupplierKey, code: string) {
  return supplier === "age" ? code : `${supplier}:${code}`;
}

// Код позиции для показа людям: без служебной приставки поставщика
export function displayCode(code: string | null | undefined) {
  return code ? code.replace(/^(darian):/, "").replace(/ #\d+$/, "") : code ?? null;
}

// Порядок поставщиков: первый — главный. Цена товара на сайте берётся у главного,
// если у него товар есть в наличии, иначе у следующего по порядку.
export function supplierOrder(db: DatabaseSync): string[] {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'supplier_order'").get() as { value: string } | undefined;
  const order = (row?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const s of SUPPLIERS) if (!order.includes(s.key)) order.push(s.key);
  return order;
}

// Схема для нескольких поставщиков (вызывается из migrate при каждом запуске)
export function migrateSuppliers(db: DatabaseSync) {
  const pcols = (db.prepare("PRAGMA table_info(price_items)").all() as { name: string }[]).map((c) => c.name);
  if (!pcols.includes("supplier")) db.exec("ALTER TABLE price_items ADD COLUMN supplier TEXT NOT NULL DEFAULT 'age'");
  // заметка поставщика к позиции («1 DONA MAVJUD», «YANGI NARX») и лист прайса
  if (!pcols.includes("note")) db.exec("ALTER TABLE price_items ADD COLUMN note TEXT");
  const icols = (db.prepare("PRAGMA table_info(price_imports)").all() as { name: string }[]).map((c) => c.name);
  if (!icols.includes("supplier")) db.exec("ALTER TABLE price_imports ADD COLUMN supplier TEXT NOT NULL DEFAULT 'age'");

  db.exec(`
    -- Все предложения поставщиков для одного товара сайта. components.price_code — то из них,
    -- по которому сейчас считается цена (выбирает resolveOffers).
    CREATE TABLE IF NOT EXISTS component_offers (
      component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
      price_code TEXT NOT NULL,
      linked_by TEXT NOT NULL DEFAULT 'auto',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (component_id, price_code)
    );
    CREATE INDEX IF NOT EXISTS idx_offers_code ON component_offers(price_code);

    -- Возможные совпадения товаров разных поставщиков, которые нужно подтвердить вручную
    CREATE TABLE IF NOT EXISTS offer_matches (
      price_code TEXT NOT NULL,
      component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | rejected
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (price_code, component_id)
    );

    -- Привязка товара к позиции прайса всегда попадает в список его предложений
    CREATE TRIGGER IF NOT EXISTS trg_offer_ins AFTER INSERT ON components WHEN NEW.price_code IS NOT NULL AND NEW.price_code <> ''
    BEGIN INSERT OR IGNORE INTO component_offers(component_id, price_code, linked_by) VALUES (NEW.id, NEW.price_code, 'manual'); END;
    CREATE TRIGGER IF NOT EXISTS trg_offer_upd AFTER UPDATE OF price_code ON components WHEN NEW.price_code IS NOT NULL AND NEW.price_code <> ''
    BEGIN INSERT OR IGNORE INTO component_offers(component_id, price_code, linked_by) VALUES (NEW.id, NEW.price_code, 'manual'); END;
  `);
  // уже существующие привязки
  db.exec(`INSERT OR IGNORE INTO component_offers(component_id, price_code, linked_by)
           SELECT id, price_code, 'manual' FROM components WHERE price_code IS NOT NULL AND price_code <> ''`);
}

// Для каждого товара с несколькими предложениями выбирает, по какому считать цену:
// главный поставщик, если у него есть в наличии; иначе следующий по порядку; у одного
// поставщика — самое дешёвое. Если в наличии нет ни у кого — у главного поставщика.
export function resolveOffers(db: DatabaseSync) {
  const order = supplierOrder(db);
  const rank = (s: string) => {
    const i = order.indexOf(s);
    return i < 0 ? 99 : i;
  };
  const rows = db
    .prepare(
      `SELECT o.component_id, o.price_code, c.price_code AS current, p.supplier, p.price, p.in_stock
       FROM component_offers o
       JOIN components c ON c.id = o.component_id
       JOIN price_items p ON p.code = o.price_code
       WHERE o.component_id IN (SELECT component_id FROM component_offers GROUP BY component_id HAVING COUNT(*) > 1)`,
    )
    .all() as { component_id: number; price_code: string; current: string | null; supplier: string; price: number; in_stock: number }[];
  const by = new Map<number, typeof rows>();
  for (const r of rows) by.set(r.component_id, [...(by.get(r.component_id) ?? []), r]);
  const upd = db.prepare("UPDATE components SET price_code = ? WHERE id = ?");
  let changed = 0;
  for (const [id, offers] of by) {
    const live = offers.filter((o) => o.in_stock === 1 && o.price > 0).sort((a, b) => rank(a.supplier) - rank(b.supplier) || a.price - b.price);
    const fallback = [...offers].sort((a, b) => rank(a.supplier) - rank(b.supplier) || Number(b.price > 0) - Number(a.price > 0));
    const best = live[0] ?? fallback[0];
    if (best && best.price_code !== best.current) {
      upd.run(best.price_code, id);
      changed++;
    }
  }
  return changed;
}
