// Делает снимок локальных данных (каталог, прайс, настройки, фото) в seed-data/
// для первого запуска на новом сервере. Заказы в снимок не попадают.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const src = path.join(process.cwd(), "data");
const out = path.join(process.cwd(), "seed-data");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const db = new DatabaseSync(path.join(src, "shop.db"));
db.exec(`VACUUM INTO '${path.join(out, "shop.db").replace(/'/g, "''")}'`);
db.close();

const snap = new DatabaseSync(path.join(out, "shop.db"));
snap.exec("DELETE FROM orders; DELETE FROM sqlite_sequence WHERE name = 'orders'; DELETE FROM settings WHERE key IN ('tg_bot_token', 'tg_chat_id');");
snap.exec("VACUUM");
snap.close();

// уменьшенные копии (.thumbs) в снимок не берём — сервер сделает их сам при первом показе
fs.cpSync(path.join(src, "uploads"), path.join(out, "uploads"), { recursive: true, filter: (p) => !p.includes(".thumbs") });
const files = fs.readdirSync(path.join(out, "uploads")).length;
console.log(`seed-data готов: shop.db + ${files} фото`);
