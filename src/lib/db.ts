import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { seedDemo } from "./seed";
import { seedBudgetBuilds } from "./budgetBuilds";
import { importAllLeftovers, importStoreItems, recategorize, recategorize2 } from "./storeImport";
import { BUILDS_UZ } from "./buildsUz";
import { migrateSuppliers, resolveOffers } from "./suppliers";
import { applyDarian, fixDarianBrands, type DarianRow } from "./darian";

// На сервере (Railway) DATA_DIR указывает на постоянный диск, локально — папка data/
export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
// Снимок данных для первого запуска на новом сервере (создаётся скриптом npm run snapshot)
const SEED_DIR = path.join(process.cwd(), "seed-data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Позиции прайс-листа поставщика (AGE UZ). Обновляются импортом.
CREATE TABLE IF NOT EXISTS price_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  stock TEXT,
  in_stock INTEGER NOT NULL DEFAULT 1,
  category TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_new INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_missing INTEGER NOT NULL DEFAULT 0,
  mapping TEXT
);

-- Комплектующие, которые мы используем в сборках. Цена берётся из прайса по коду.
CREATE TABLE IF NOT EXISTS components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  price_code TEXT,
  manual_price REAL,
  specs TEXT NOT NULL DEFAULT '{}',
  image TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_components_code ON components(price_code);

CREATE TABLE IF NOT EXISTS builds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  purpose TEXT NOT NULL DEFAULT 'gaming',
  image TEXT,
  markup_percent REAL,
  assembly_fee REAL,
  extra_price REAL NOT NULL DEFAULT 0,
  fps TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS build_items (
  build_id INTEGER NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  qty INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (build_id, component_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  comment TEXT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  items TEXT NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
);
`;

declare global {
  var __shopDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  // Первый запуск на пустом диске: переносим снимок каталога, прайса и фото
  if (!fs.existsSync(path.join(DATA_DIR, "shop.db")) && fs.existsSync(path.join(SEED_DIR, "shop.db"))) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.cpSync(SEED_DIR, DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new DatabaseSync(path.join(DATA_DIR, "shop.db"));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const cols = (db.prepare("PRAGMA table_info(components)").all() as { name: string }[]).map((c) => c.name);
  const count = db.prepare("SELECT COUNT(*) AS c FROM components").get() as { c: number };
  // стартовый каталог — только в новую базу (в ней схема уже со всеми колонками)
  if (count.c === 0 && cols.includes("image")) seedDemo(db);
  migrate(db);
  return db;
}

// Простые миграции для уже созданных баз
function migrate(db: DatabaseSync) {
  const cols = (db.prepare("PRAGMA table_info(components)").all() as { name: string }[]).map((c) => c.name);
  if (!cols.includes("image")) db.exec("ALTER TABLE components ADD COLUMN image TEXT");
  // 1 — автопоиск фото уже пробовали (чтобы не искать заново при каждом запуске)
  if (!cols.includes("image_checked")) db.exec("ALTER TABLE components ADD COLUMN image_checked INTEGER NOT NULL DEFAULT 0");
  // своя наценка товара, % (пусто — общая из настроек)
  if (!cols.includes("markup_percent")) db.exec("ALTER TABLE components ADD COLUMN markup_percent REAL");

  // Заявки на коммерческое предложение от компаний (B2B)
  const ocols = (db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]).map((c) => c.name);
  for (const [c, type] of [["company", "TEXT"], ["inn", "TEXT"], ["segment", "TEXT"], ["qty", "INTEGER"]]) {
    if (!ocols.includes(c)) db.exec(`ALTER TABLE orders ADD COLUMN ${c} ${type}`);
  }

  // Узбекские тексты сборок (основной язык сайта)
  const bcols = (db.prepare("PRAGMA table_info(builds)").all() as { name: string }[]).map((c) => c.name);
  for (const c of ["name_uz", "tagline_uz", "description_uz", "fps_uz"]) {
    if (!bcols.includes(c)) db.exec(`ALTER TABLE builds ADD COLUMN ${c} TEXT`);
  }
  const fill = db.prepare(
    `UPDATE builds SET name_uz = COALESCE(NULLIF(name_uz, ''), ?), tagline_uz = COALESCE(NULLIF(tagline_uz, ''), ?),
       description_uz = COALESCE(NULLIF(description_uz, ''), ?), fps_uz = COALESCE(NULLIF(fps_uz, ''), ?) WHERE slug = ?`,
  );
  for (const [slug, v] of Object.entries(BUILDS_UZ)) fill.run(v.name, v.tagline, v.description, v.fps, slug);

  seedBudgetBuilds(db);
  importStoreItems(db);
  importAllLeftovers(db);
  recategorize(db);
  recategorize2(db);
  // сначала прайсы поставщиков (создают товары), потом фото — патч фото ищет товары по названию
  migrateSuppliers(db);
  applySeedPrices(db);
  fixDarianBrands(db);
  applyPhotoPatch(db);
  applyPhotoReplace(db);
}

// Прайсы поставщиков, положенные в seed-data/prices/<поставщик>.json (разобранные заранее —
// scripts/darian-seed.mjs). Загружаются один раз на каждую новую версию файла: так прайс попадает
// и на сервер без ручной загрузки в админке. Дальше прайс обновляют загрузкой файла в админке.
function applySeedPrices(db: DatabaseSync) {
  const file = path.join(SEED_DIR, "prices", "darian.json");
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  const version = crypto.createHash("sha1").update(raw).digest("hex");
  const done = db.prepare("SELECT value FROM settings WHERE key = 'seed_price_darian'").get() as { value: string } | undefined;
  if (done?.value === version) return;
  const { filename, rows } = JSON.parse(raw) as { filename: string; rows: DarianRow[] };
  applyDarian(db, rows, filename);
  db.prepare("INSERT INTO settings(key, value) VALUES ('seed_price_darian', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(version);
  resolveOffers(db);
}

// Старые фото, переведённые в единый формат (scripts/renormalize-photos.mjs → seed-data/photo-replace.json):
// «/uploads/старый.webp» или «/img/parts/…» → новый файл. Меняем только товары, у которых стоит
// именно это старое фото, — фото, загруженные вручную на сервере, не трогаем.
function applyPhotoReplace(db: DatabaseSync) {
  const file = path.join(SEED_DIR, "photo-replace.json");
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  const version = crypto.createHash("sha1").update(raw).digest("hex");
  const done = db.prepare("SELECT value FROM settings WHERE key = 'photo_replace_version'").get() as { value: string } | undefined;
  if (done?.value === version) return;
  const map = JSON.parse(raw) as Record<string, string>;
  const upd = db.prepare("UPDATE components SET image = ? WHERE image = ?");
  for (const [old, img] of Object.entries(map)) {
    const src = path.join(SEED_DIR, "photo-patch", img);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(UPLOADS_DIR, img);
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    upd.run(`/uploads/${img}`, old);
  }
  db.prepare("INSERT INTO settings(key, value) VALUES ('photo_replace_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(version);
}

// Фото, найденные скриптом scripts/fill-photos.mjs (seed-data/photo-patch*): подставляем товарам,
// у которых фото ещё нет. Повторяется только когда патч меняется; ручные фото не трогаем.
function applyPhotoPatch(db: DatabaseSync) {
  const file = path.join(SEED_DIR, "photo-patch.json");
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  const version = crypto.createHash("sha1").update(raw).digest("hex");
  const done = db.prepare("SELECT value FROM settings WHERE key = 'photo_patch_version'").get() as { value: string } | undefined;
  if (done?.value === version) return;
  const patch = JSON.parse(raw) as Record<string, string>;
  const upd = db.prepare("UPDATE components SET image = ?, image_checked = 1 WHERE name = ? AND (image IS NULL OR image = '')");
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  for (const [name, img] of Object.entries(patch)) {
    const src = path.join(SEED_DIR, "photo-patch", img);
    if (!fs.existsSync(src)) continue;
    const dst = path.join(UPLOADS_DIR, img);
    if (!fs.existsSync(dst)) fs.copyFileSync(src, dst);
    upd.run(`/uploads/${img}`, name);
  }
  db.prepare("INSERT INTO settings(key, value) VALUES ('photo_patch_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(version);
}

export function db(): DatabaseSync {
  if (!globalThis.__shopDb) globalThis.__shopDb = open();
  return globalThis.__shopDb;
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
