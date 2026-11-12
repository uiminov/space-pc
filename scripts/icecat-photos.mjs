// Фото из Icecat (открытая база товаров производителей) по модельным кодам из названия.
// Нужен, когда поиск картинок недоступен; лучше всего находит мониторы и технику с кодом модели в названии.
// Запуск: node scripts/icecat-photos.mjs [--supplier darian] [--limit N]
// Найденные фото: data/uploads + seed-data/photo-patch (на сервер попадут при выкладке, как у fill-photos.mjs).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { normalize } from "./fill-photos.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const UPLOADS = path.join(ROOT, "data", "uploads");
const PATCH_DIR = path.join(ROOT, "seed-data", "photo-patch");
const PATCH_JSON = path.join(ROOT, "seed-data", "photo-patch.json");
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const SUPPLIER = (arg("--supplier") ?? "darian").replace(/[^a-z]/g, "");
const LIMIT = Number(arg("--limit") ?? Infinity);

// модельные коды: буквы+цифры, без объёмов, частот, процессоров и разъёмов
const NOT = /^(\d+(GB|TB|MB|HZ|W|MS|MC|K|P|DPI)|DDR\d|LPDDR\d+X?|RTX\d+(TI)?|GTX\d+|W1[01]|FHD|QHD|UHD|WQHD|USB\d?|HDMI\d?|IPS|OLED|WUXGA|\d+X\d+|\d?[A-Z]+\d{5}|I[3579]-?\d{4,5}[A-Z]*|[3579]-\d{3,4}[A-Z]*|R[3579]-?\d{2,4}[A-Z]*|N\d{3,4}|\d{3,4}[UHV]|ULTRA\d?)$/;
function codes(name) {
  const toks = name
    .toUpperCase()
    .replace(/[(),"”/]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 5 && /\d/.test(w) && /[A-Z]/.test(w) && !/[+*]/.test(w) && !NOT.test(w));
  const out = [];
  for (const t of toks) {
    out.push(t);
    if (/^L[SFC]\d{2}/.test(t) && t.length > 10) out.push(t.slice(0, 10)); // Samsung: LS27C312EAIXCI → LS27C312EA
    if (/-B\.\w+$/.test(t)) out.push(t.replace(/\.\w+$/, "")); // LG: 22MP410-B.ADG → 22MP410-B
  }
  return [...new Set(out)].slice(0, 5);
}

async function icecat(brand, code) {
  try {
    const r = await fetch(`https://live.icecat.biz/api/?UserName=openIcecat-live&Language=en&Brand=${encodeURIComponent(brand)}&ProductCode=${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(15000),
    });
    const j = await r.json();
    return j.data?.Image?.HighPic || j.data?.Image?.Pic500x500 || null;
  } catch {
    return null;
  }
}

async function download(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 5000 ? buf : null;
  } catch {
    return null;
  }
}

const db = new DatabaseSync(path.join(ROOT, "data", "shop.db"));
const rows = db
  .prepare(
    `SELECT c.id, c.name, c.brand, p.name AS pname FROM components c JOIN price_items p ON p.code = c.price_code
     WHERE c.active = 1 AND (c.image IS NULL OR c.image = '') AND p.supplier = ? ORDER BY c.category, c.id`,
  )
  .all(SUPPLIER)
  .slice(0, LIMIT);
const patch = fs.existsSync(PATCH_JSON) ? JSON.parse(fs.readFileSync(PATCH_JSON, "utf8")) : {};
const upd = db.prepare("UPDATE components SET image = ?, image_checked = 1 WHERE id = ?");
fs.mkdirSync(UPLOADS, { recursive: true });
fs.mkdirSync(PATCH_DIR, { recursive: true });
let ok = 0;
for (const row of rows) {
  if (!row.brand) {
    console.log(`– ${row.name.slice(0, 70)} (нет бренда)`);
    continue;
  }
  let found = null;
  for (const code of codes(row.pname)) {
    const url = await icecat(row.brand, code);
    if (url) {
      found = { url, code };
      break;
    }
  }
  const buf = found ? await download(found.url) : null;
  if (!buf) {
    console.log(`✗ ${row.name.slice(0, 70)}`);
    continue;
  }
  const out = await normalize(buf);
  const file = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  fs.writeFileSync(path.join(UPLOADS, file), out);
  fs.copyFileSync(path.join(UPLOADS, file), path.join(PATCH_DIR, file));
  upd.run(`/uploads/${file}`, row.id);
  patch[row.name] = file;
  fs.writeFileSync(PATCH_JSON, JSON.stringify(patch, null, 1));
  ok++;
  console.log(`✓ ${row.name.slice(0, 70)}  ← icecat ${found.code}`);
}
console.log(`\nГотово: найдено ${ok} из ${rows.length}`);
