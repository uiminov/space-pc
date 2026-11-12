// Отбраковка неудачных автоматически найденных фото (водяные знаки, инфографика, вид сзади).
// Снимает фото с товаров, убирает их из seed-data/photo-patch и запоминает сайт-источник
// в data/photo-reject.json, чтобы fill-photos.mjs не взял ту же картинку повторно.
//
// Запуск: node scripts/reject-photos.mjs <лог fill-photos> <id товара> [<id> …]
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const [logFile, ...ids] = process.argv.slice(2);
const log = fs.readFileSync(logFile, "utf8").split("\n");
const db = new DatabaseSync(path.join(ROOT, "data", "shop.db"));
const PATCH_JSON = path.join(ROOT, "seed-data", "photo-patch.json");
const REJECT_JSON = path.join(ROOT, "data", "photo-reject.json");
const patch = JSON.parse(fs.readFileSync(PATCH_JSON, "utf8"));
const reject = fs.existsSync(REJECT_JSON) ? JSON.parse(fs.readFileSync(REJECT_JSON, "utf8")) : {};

for (const id of ids.map(Number)) {
  const row = db.prepare("SELECT name, image FROM components WHERE id = ?").get(id);
  if (!row?.image?.startsWith("/uploads/")) continue;
  const line = log.find((l) => l.startsWith("✓") && l.includes(` ${row.name.slice(0, 60)}  ← `));
  const host = line?.split("← ")[1]?.trim();
  if (host) reject[row.name] = [...new Set([...(reject[row.name] ?? []), host])];
  const file = path.basename(row.image);
  db.prepare("UPDATE components SET image = NULL WHERE id = ?").run(id);
  for (const k of Object.keys(patch)) if (patch[k] === file) delete patch[k];
  fs.rmSync(path.join(ROOT, "seed-data", "photo-patch", file), { force: true });
  console.log(`снято: ${row.name.slice(0, 60)} (${host ?? "источник неизвестен"})`);
}
fs.writeFileSync(PATCH_JSON, JSON.stringify(patch, null, 1));
fs.writeFileSync(REJECT_JSON, JSON.stringify(reject, null, 1));
