// Готовит прайс Darian для сервера: node scripts/darian-seed.mjs "путь/к/прайсу.xlsx"
// Пишет seed-data/prices/darian.json — сервер при запуске загрузит его один раз (lib/db.ts → applySeedPrices).
// Обычное обновление прайса — загрузкой файла в админке (/admin/prices/darian); скрипт нужен для первой выкладки.
import { registerHooks } from "node:module";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

// модули проекта написаны на TypeScript с импортами без расширения
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: "data:text/javascript,", shortCircuit: true };
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".")) return next(spec + ".ts", ctx);
      throw e;
    }
  },
});
const { parseDarianRows } = await import(new URL("../src/lib/darian.ts", import.meta.url).href);

const src = process.argv[2];
if (!src) {
  console.error('Укажите файл: node scripts/darian-seed.mjs "NEW PRICE.xlsx"');
  process.exit(1);
}
const text = (v) => {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("error" in v) return "";
    if ("result" in v) return text(v.result);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    return "";
  }
  return String(v);
};
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(src);
const sheets = wb.worksheets.map((ws) => {
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (r) => {
    const arr = [];
    for (let i = 1; i < r.values.length; i++) arr.push(text(r.values[i]).replace(/\s+/g, " ").trim());
    rows.push(arr);
  });
  return { name: ws.name, rows };
});
const rows = parseDarianRows(sheets);
const out = path.join(import.meta.dirname, "..", "seed-data", "prices", "darian.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ filename: path.basename(src), rows }, null, 1));
console.log(`${rows.length} позиций (${rows.filter((r) => r.price).length} с ценой) → ${out}`);
