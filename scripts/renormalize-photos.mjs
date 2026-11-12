// Переводит старые фото товаров в единый формат (квадрат 800×800, белый фон, одинаковые поля —
// см. normalize в fill-photos.mjs), чтобы все карточки на сайте выглядели одинаково.
// Новые файлы кладутся в data/uploads и seed-data/photo-patch/, а соответствие «старое фото → новое»
// — в seed-data/photo-replace.json: при запуске на сервере его применяет applyPhotoReplace (src/lib/db.ts).
// Фото, загруженные вручную прямо на сервере, туда не попадают — их можно перезалить в админке.
//
// Запуск: node scripts/renormalize-photos.mjs [--before <метка времени из имени файла>]
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalize } from "./fill-photos.mjs";

const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "data", "uploads");
const PATCH_DIR = path.join(ROOT, "seed-data", "photo-patch");
const PATCH_JSON = path.join(ROOT, "seed-data", "photo-patch.json");
const REPLACE_JSON = path.join(ROOT, "seed-data", "photo-replace.json");
const i = process.argv.indexOf("--before");
// файлы, созданные новым fill-photos.mjs, уже в нужном формате (имя начинается с Date.now())
const BEFORE = i > 0 ? Number(process.argv[i + 1]) : 1794393800000;

const db = new DatabaseSync(path.join(ROOT, "data", "shop.db"));
const replace = fs.existsSync(REPLACE_JSON) ? JSON.parse(fs.readFileSync(REPLACE_JSON, "utf8")) : {};
const patch = fs.existsSync(PATCH_JSON) ? JSON.parse(fs.readFileSync(PATCH_JSON, "utf8")) : {};
const images = db.prepare("SELECT DISTINCT image FROM components WHERE image IS NOT NULL AND image != ''").all().map((r) => r.image);
const upd = db.prepare("UPDATE components SET image = ? WHERE image = ?");

function sourceFile(img) {
  if (img.startsWith("/uploads/")) return path.join(UPLOADS, img.slice("/uploads/".length));
  if (img.startsWith("/img/")) return path.join(ROOT, "public", img);
  return null;
}

let done = 0;
for (const img of images) {
  if (Object.values(replace).includes(img.replace("/uploads/", ""))) continue;
  const ts = Number(path.basename(img).split("-")[0]);
  if (img.startsWith("/uploads/") && ts >= BEFORE) continue;
  const src = sourceFile(img);
  if (!src || !fs.existsSync(src)) continue;
  try {
    const out = await normalize(fs.readFileSync(src));
    const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
    fs.writeFileSync(path.join(UPLOADS, name), out);
    fs.copyFileSync(path.join(UPLOADS, name), path.join(PATCH_DIR, name));
    replace[img] = name;
    upd.run(`/uploads/${name}`, img);
    const old = path.basename(img);
    for (const k of Object.keys(patch)) if (patch[k] === old) patch[k] = name;
    done++;
  } catch (e) {
    console.log(`! ${img}: ${e.message}`);
  }
}
fs.writeFileSync(REPLACE_JSON, JSON.stringify(replace, null, 1));
fs.writeFileSync(PATCH_JSON, JSON.stringify(patch, null, 1));
console.log(`Переведено в единый формат: ${done}, всего замен: ${Object.keys(replace).length}`);
