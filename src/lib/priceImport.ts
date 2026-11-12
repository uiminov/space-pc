import "server-only";
import ExcelJS from "exceljs";
import { db, tx } from "./db";
import { categoryLabel, guessCategory } from "./catalog";
import { resolveOffers } from "./suppliers";
import { parseDarianRows, type DarianRow } from "./darian";

export type Mapping = {
  code?: string;
  name?: string;
  price?: string;
  stock?: string;
  category?: string;
};

export type ParsedRow = { code: string; name: string; price: number; stock: string | null; inStock: boolean; category: string | null };

export type ImportResult = {
  filename: string;
  headerRow: number;
  columns: Record<keyof Mapping, string | null>;
  rows: ParsedRow[];
  skipped: number;
};

const DETECT: Record<keyof Mapping, RegExp> = {
  code: /^(код|артикул|арт\.?|code|sku|id|№ ?товара|part ?number|p\/n)/i,
  name: /(наименование|название|товар|модель|описание|name|model|product)/i,
  price: /(цена|price|usd|\$|стоимость|дилер|опт|сум)/i,
  stock: /(наличие|остаток|склад|stock|кол-?во|qty|количество)/i,
  category: /(категория|группа|раздел|category|тип)/i,
};

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString();
    const o = v as Record<string, unknown>;
    if ("error" in o) return ""; // #N/A, #NAME? и т.п.
    if ("result" in o) return cellText(o.result);
    if ("formula" in o || "sharedFormula" in o) return "";
    if ("text" in o) return String(o.text);
    if ("richText" in o) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("hyperlink" in o) return String(o.text ?? o.hyperlink);
    return "";
  }
  return String(v).trim();
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [";", "\t", ","].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cur.trim());
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  if (cur || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

async function readTable(file: File): Promise<string[][]> {
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    let text = buf.toString("utf8");
    if (text.includes("�")) text = new TextDecoder("windows-1251").decode(buf);
    return parseCsv(text.replace(/^﻿/, ""));
  }
  if (name.endsWith(".xls")) {
    throw new Error("Формат .xls (Excel 97-2003) не поддерживается. Откройте файл в Excel и сохраните как .xlsx.");
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheetRows = (ws: ExcelJS.Worksheet) => {
    const out: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = r.values as unknown[];
      const arr: string[] = [];
      for (let i = 1; i < vals.length; i++) arr.push(cellText(vals[i]));
      out.push(arr);
    });
    return out;
  };
  // У AGE UZ есть сводный лист «Export» со всеми позициями в наличии — берём только его.
  const exportSheet = wb.worksheets.find((w) => /^export$/i.test(w.name.trim()));
  if (exportSheet) return sheetRows(exportSheet);
  // Иначе берём все листы подряд — у поставщиков прайс часто разбит по листам-категориям.
  return wb.worksheets.flatMap(sheetRows);
}

// Прайс Darian: .xlsx с листами по типам товаров (формат разбирает parseDarianRows)
export async function readDarianFile(file: File): Promise<DarianRow[]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Прайс Darian загружается в формате .xlsx — как его присылает поставщик.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
  const sheets = wb.worksheets.map((ws) => {
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (r) => {
      const vals = r.values as unknown[];
      const arr: string[] = [];
      for (let i = 1; i < vals.length; i++) arr.push(cellText(vals[i]).replace(/\s+/g, " ").trim());
      rows.push(arr);
    });
    return { name: ws.name, rows };
  });
  const rows = parseDarianRows(sheets);
  if (!rows.length) throw new Error("Не нашли в файле ни одной позиции. Это точно прайс Darian?");
  return rows;
}

function colIndex(spec: string | undefined, header: string[]): number | null {
  if (!spec) return null;
  const s = spec.trim();
  if (!s) return null;
  if (/^[A-Za-z]{1,2}$/.test(s)) {
    const up = s.toUpperCase();
    let n = 0;
    for (const ch of up) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  }
  if (/^\d+$/.test(s)) return parseInt(s, 10) - 1;
  const i = header.findIndex((h) => h.toLowerCase() === s.toLowerCase());
  if (i >= 0) return i;
  const j = header.findIndex((h) => h.toLowerCase().includes(s.toLowerCase()));
  return j >= 0 ? j : null;
}

// Определение колонок по содержимому, когда строки заголовков нет
function profileColumns(rows: string[][]) {
  const width = Math.max(0, ...rows.map((r) => r.length));
  const stats = Array.from({ length: width }, (_, i) => {
    const cells = rows.map((r) => (r[i] ?? "").trim()).filter(Boolean);
    const n = cells.length || 1;
    return {
      i,
      fill: cells.length / (rows.length || 1),
      numeric: cells.filter((c) => /^[\s$]*[\d\s]+([.,]\d*)?[\s$]*$/.test(c) && !isNaN(parsePrice(c))).length / n,
      spaces: cells.filter((c) => /\s/.test(c)).length / n,
      len: cells.reduce((a, c) => a + c.length, 0) / n,
    };
  });
  const price = stats.filter((s) => s.numeric > 0.6 && s.fill > 0.3).sort((a, b) => b.fill * b.numeric - a.fill * a.numeric)[0]?.i ?? null;
  const name = stats.filter((s) => s.i !== price && s.spaces > 0.5).sort((a, b) => b.len * b.fill - a.len * a.fill)[0]?.i ?? null;
  const code = stats.filter((s) => s.i !== price && s.i !== name && s.fill > 0.2 && s.spaces < 0.4 && s.len < 40 && s.numeric < 0.5).sort((a, b) => b.fill - a.fill)[0]?.i ?? null;
  return { price, name, code };
}

function colLetter(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function parsePrice(s: string): number {
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned) return NaN;
  // "1 234,56" / "1,234.56" / "1234.56"
  let n = cleaned;
  if (n.includes(",") && n.includes(".")) n = n.lastIndexOf(",") > n.lastIndexOf(".") ? n.replace(/\./g, "").replace(",", ".") : n.replace(/,/g, "");
  else if (n.includes(",")) n = /,\d{1,2}$/.test(n) ? n.replace(",", ".") : n.replace(/,/g, "");
  return parseFloat(n);
}

function parseStock(s: string | null): boolean {
  if (s == null) return true;
  const t = s.trim().toLowerCase();
  if (!t) return false;
  if (/(нет|out|под заказ|ожида|transit|0 шт)/.test(t)) return false;
  const n = parseFloat(t.replace(",", "."));
  if (!isNaN(n) && /^[\d.,\s]+$/.test(t)) return n > 0;
  return true; // «есть», «много», «+», «>10» и т.п.
}

export async function parsePriceFile(file: File, mapping: Mapping): Promise<ImportResult> {
  const table = await readTable(file);
  if (!table.length) throw new Error("Файл пустой");

  // Ищем строку заголовков среди первых 40 строк
  let headerRow = -1;
  let best = 0;
  for (let i = 0; i < Math.min(40, table.length); i++) {
    const r = table[i];
    let score = 0;
    for (const k of ["code", "name", "price", "stock"] as const) if (r.some((c) => DETECT[k].test(c))) score++;
    if (score > best) {
      best = score;
      headerRow = i;
    }
  }
  if (best < 2) headerRow = -1; // настоящий заголовок содержит хотя бы 2 узнаваемых колонки
  const header = headerRow >= 0 ? table[headerRow] : [];

  const idx: Record<keyof Mapping, number | null> = { code: null, name: null, price: null, stock: null, category: null };
  const used = new Set<number>();
  for (const k of ["name", "price", "code", "stock", "category"] as (keyof Mapping)[]) {
    let i = colIndex(mapping[k], header);
    if (i == null && headerRow >= 0) {
      i = header.findIndex((h, j) => !used.has(j) && h && DETECT[k].test(h));
      if (i < 0) i = null;
    }
    if (i != null) used.add(i);
    idx[k] = i;
  }
  if (headerRow < 0 && (idx.name == null || idx.price == null)) {
    const prof = profileColumns(table.slice(0, 400));
    idx.price ??= prof.price;
    idx.name ??= prof.name;
    if (idx.code == null && prof.code != null && prof.code !== idx.name && prof.code !== idx.price) idx.code = prof.code;
  }
  if (idx.name == null || idx.price == null) {
    throw new Error(
      "Не удалось определить колонки «Наименование» и «Цена». Укажите их вручную (буквой колонки, например B и E).",
    );
  }

  const rows: ParsedRow[] = [];
  let skipped = 0;
  let currentCategory: string | null = null;
  const seenCodes = new Map<string, string>();
  for (let i = headerRow + 1; i < table.length; i++) {
    const r = table[i];
    const name = (r[idx.name] ?? "").replace(/\s+/g, " ").trim(); // в прайсе бывают многострочные названия
    const priceRaw = (r[idx.price] ?? "").trim();
    const price = parsePrice(priceRaw);
    const filled = r.filter((c) => c && c.trim()).length;
    if (!filled) continue;
    if ((isNaN(price) || price <= 0) && filled <= 2) {
      // строка-заголовок раздела: «Видеокарты», «Процессоры AMD»…
      currentCategory = (r.find((c) => c && c.trim()) ?? "").trim() || currentCategory;
      continue;
    }
    if (!name || isNaN(price)) {
      skipped++;
      continue;
    }
    let code = (idx.code != null ? r[idx.code] : "")?.replace(/\s+/g, " ").trim() || name;
    const prevName = seenCodes.get(code);
    if (prevName != null && prevName !== name) code = `${code} | ${name}`; // один артикул у разных товаров
    seenCodes.set(code, name);
    const stock = idx.stock != null ? (r[idx.stock] ?? "").trim() : null;
    rows.push({
      code,
      name,
      price,
      stock,
      inStock: price > 0 && parseStock(stock),
      category: (idx.category != null ? r[idx.category]?.trim() : null) || currentCategory || categoryLabel(guessCategory(name)),
    });
  }

  const colName = (i: number | null) =>
    i == null ? null : `${colLetter(i)}${header[i] ? ` — «${header[i]}»` : ""}`;
  return {
    filename: file.name,
    headerRow: headerRow + 1,
    columns: {
      code: colName(idx.code),
      name: colName(idx.name),
      price: colName(idx.price),
      stock: colName(idx.stock),
      category: colName(idx.category),
    },
    rows,
    skipped,
  };
}

// Загрузка прайса AGE: трогает только позиции AGE (позиции других поставщиков — в своих прайсах)
export function applyImport(result: ImportResult, missingMode: string) {
  return tx(() => {
    const d = db();
    const existing = new Set((d.prepare("SELECT code FROM price_items WHERE supplier = 'age'").all() as { code: string }[]).map((r) => r.code));
    const upsert = d.prepare(`
      INSERT INTO price_items(code, name, price, stock, in_stock, category, supplier, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'age', datetime('now'))
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, price = excluded.price, stock = excluded.stock,
        in_stock = excluded.in_stock, category = excluded.category, updated_at = excluded.updated_at
    `);
    let created = 0;
    let updated = 0;
    const seen = new Set<string>();
    for (const r of result.rows) {
      if (seen.has(r.code)) continue;
      seen.add(r.code);
      upsert.run(r.code, r.name, r.price, r.stock, r.inStock ? 1 : 0, r.category);
      if (existing.has(r.code)) updated++;
      else created++;
    }
    const missing = [...existing].filter((c) => !seen.has(c));
    if (missing.length) {
      if (missingMode === "delete") {
        const del = d.prepare("DELETE FROM price_items WHERE code = ?");
        for (const c of missing) del.run(c);
      } else if (missingMode === "out_of_stock") {
        const upd = d.prepare("UPDATE price_items SET in_stock = 0, stock = 'нет в прайсе' WHERE code = ?");
        for (const c of missing) upd.run(c);
      }
    }
    d.prepare(
      "INSERT INTO price_imports(filename, rows_total, rows_new, rows_updated, rows_missing, mapping, supplier) VALUES (?, ?, ?, ?, ?, ?, 'age')",
    ).run(result.filename, seen.size, created, updated, missing.length, JSON.stringify(result.columns));
    // наличие у AGE поменялось — пересчитать, у какого поставщика брать цену товаров с несколькими предложениями
    resolveOffers(d);
    return { total: seen.size, created, updated, missing: missing.length };
  });
}
