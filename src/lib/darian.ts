import type { DatabaseSync } from "node:sqlite";
import { guessStore } from "./storeCats";
import { detectBrand } from "./partInfo";
import { prefixed, resolveOffers } from "./suppliers";

// Прайс Darian (ноутбуки, моноблоки, мониторы, аксессуары). Формат — несколько листов,
// в строке: [код] название цена; цена в долларах, «.» — цены нет (не продают сейчас).
// На листе аксессуаров две таблицы стоят рядом, кода нет — ищем пары «название → цена» по всей строке.

export type DarianRow = { code: string; name: string; price: number | null; sheet: string; note: string | null; section?: string | null };

const isPrice = (s: string) => /^\d+([.,]\d+)?$/.test(s);
const SKIP = /To'lov|^CODE$|NEW ARRIVALS|^ALL-IN-ONE$/i;

export function parseDarianRows(sheets: { name: string; rows: string[][] }[]): DarianRow[] {
  const out: DarianRow[] = [];
  const seen = new Set<string>();
  for (const sh of sheets) {
    const sheet = sh.name.trim();
    // заголовки разделов («MOUSE | MOUSE», «WEB CAM | WEB CAM») — по колонке, где начинается таблица
    const headerAt = new Map<number, string>();
    for (const c of sh.rows) {
      for (let j = 0; j < c.length; j++) {
        if (c[j] && c[j] === c[j + 1] && !isPrice(c[j]) && !/To'lov/i.test(c[j])) headerAt.set(j, c[j].trim());
      }
      const sectionAt = (i: number) => {
        let best = -1;
        for (const k of headerAt.keys()) if (k <= i && k > best) best = k;
        return best >= 0 ? headerAt.get(best)! : null;
      };
      for (let i = 0; i < c.length; i++) {
        let name = c[i];
        if (!name || name.length < 6 || SKIP.test(name) || isPrice(name)) continue;
        const next = c[i + 1] ?? "";
        if (!(isPrice(next) || next === ".")) continue;
        const prev = (c[i - 1] ?? "").trim();
        let code = /^[A-Z][A-Za-z0-9]*\d{3,}$/.test(prev) ? prev : null;
        // аксессуары: «A4TECH FM12 | A4Tech Fstyler Wired Optical Mouse» — модель в соседней колонке
        if (!code && prev && !isPrice(prev) && !SKIP.test(prev) && prev.length <= 30 && !name.toUpperCase().includes(prev.toUpperCase())) {
          const model = prev.replace(/^\S+\s+/, ""); // без бренда — он есть в описании
          name = `${name} ${model}`;
        }
        const after = c[i + 2] ?? "";
        const note = after && !isPrice(after) && !SKIP.test(after) ? after : null;
        code = code ?? name;
        if (seen.has(code)) code = `${code} #${out.length}`;
        seen.add(code);
        out.push({ code, name, price: isPrice(next) ? Number(next.replace(",", ".")) : null, sheet, note, section: sectionAt(i) });
        i++;
      }
    }
  }
  return out;
}

// ---------- Названия ----------

const KEEP_UPPER = new Set(
  "ASUS HP AMD MSI LG AOC IPS VA TN FHD QHD UHD WQHD UWQHD WUXGA WQXGA OLED QD-OLED LED SSD HDD DDR3 DDR4 DDR5 LPDDR4 LPDDR4X LPDDR5 LPDDR5X RTX GTX NVIDIA AI USB HDMI VGA DP W11 W10 PRO GB TB HZ ROG TUF LOQ AIO II III UFS EMMC RAM WIFI".split(" "),
);
// «ACER ASPIRE LITE AL15-53» → «Acer Aspire Lite AL15-53»: слова из одних букв — с заглавной, модели и сокращения как есть
export function prettyName(raw: string) {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => {
      if (!/^[A-Za-z]+$/.test(w) || w.length < 4 || KEEP_UPPER.has(w.toUpperCase()) || w !== w.toUpperCase()) return w;
      return w[0] + w.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bPredatpr\b/, "Predator")
    .replace(/\bBalck\b/, "Black");
}

// ---------- Конфигурация ----------

export type Config = { cpu?: string; ram?: string; ssd?: string; gpu?: string };

// Приводит название к набору характеристик, по которым видно, одинаковые ли это товары
export function configOf(raw: string): Config {
  const t = raw.toUpperCase().replace(/\s+/g, " ");
  const c: Config = {};
  // [шаблон, приставка]: «ULTRA 5 225H» / «U5-225H» → U5-225H, «I7-13650HX» / «Core i7-13650HX» → I7-13650HX,
  // «CORE 5-120U» → C5-120U, «Ryzen 5-7520U» / «R5-7520U» → R5-7520U
  const CPU: [RegExp, string][] = [
    [/ULTRA\s*X?(\d)[ -]?(\d{3}[A-Z]{0,2})\b/, "U"],
    [/\bU(\d)-(\d{3}[A-Z]{0,2})\b/, "U"],
    [/\bI([3579])[ -]?(\d{4,5}[A-Z]{0,2})\b/, "I"],
    [/CORE\s*(\d)[ -](\d{3}[A-Z]{0,2})\b/, "C"],
    [/RYZEN\s*(\d)[ -](\d{2,4}[A-Z]{0,2})\b/, "R"],
    [/\bR([3579])[ -](\d{2,4}[A-Z]{0,2})\b/, "R"],
  ];
  for (const [re, p] of CPU) {
    const m = t.match(re);
    if (m) {
      c.cpu = `${p}${m[1]}-${m[2]}`;
      break;
    }
  }
  c.cpu ??= t.match(/\b(?:I3-)?(N\d{3,4})\b/)?.[1];
  if (!c.cpu) delete c.cpu;
  // память: первое «N GB» до 64 (у Darian «16GB DDR5», у AGE «DDR5 16GB»)
  const gbs = [...t.matchAll(/\b(\d{1,4})\s?(GB|TB)\b/g)].map((m) => ({ n: Number(m[1]), u: m[2], i: m.index ?? 0 }));
  const ram = gbs.find((g) => g.u === "GB" && g.n <= 64 && g.n >= 2);
  if (ram) c.ram = `${ram.n}`;
  const disk = gbs.find((g) => g.i > (ram?.i ?? -1) && (g.u === "TB" || g.n >= 128));
  if (disk) c.ssd = disk.u === "TB" ? `${disk.n * 1024}` : `${disk.n}`;
  const gpu = t.match(/\b(RTX|GTX)\s?(\d{4})\s?(TI)?\b/);
  if (gpu) c.gpu = `${gpu[1]}${gpu[2]}${gpu[3] ?? ""}`;
  return c;
}

// Модельные коды из названия: «15-FC0196NIA», «G34WQC2», «UX3405C», «TB-8505X». Без процессоров и объёмов.
const NOT_MODEL = /^(\d+(GB|TB|MB|HZ|W|MS|MC|MHZ|GHZ|DPI|P|K)|DDR\d|LPDDR\d+X?|RTX\d+(TI)?|GTX\d+|W1[01]|WIN1[01]\w*|FHD|QHD|UHD|WQHD|USB\d?|HDMI\d?|IPS|OLED|WUXGA|NVME|PCIE\d?|\d+X\d+|A4TECH|\d?[A-Z]+\d{5})$/;
const CPU_TOKEN = /^(I[3579]-?\d{4,5}[A-Z]*|[3579]-\d{3,4}[A-Z]*|U\d-\d{3}[A-Z]*|R[3579]-?\d{2,4}[A-Z]*|\d{4,5}(U|H|HX|HS|V)|N\d{3,4}|I3-N\d{3}|\d{3}[UHV])$/;

const COLORS: [RegExp, string][] = [
  [/\bBLACK\b|\bBALCK\b/, "black"],
  [/\bWHITE\b/, "white"],
  [/\bSILVER\b/, "silver"],
  [/\bGR[EA]Y\b/, "gray"],
  [/\bBLUE\b/, "blue"],
  [/\bGREEN\b/, "green"],
  [/\bPINK\b/, "pink"],
  [/\bRED\b/, "red"],
  [/\bGOLD\b/, "gold"],
];
const colorsOf = (t: string) => new Set(COLORS.filter(([re]) => re.test(t)).map(([, c]) => c));
// Разные значения одного свойства у обоих названий: цвет, диагональ, частота экрана
function differs(a: string, b: string): string | null {
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  const ca = colorsOf(A);
  const cb = colorsOf(B);
  if (ca.size && cb.size && ![...ca].some((c) => cb.has(c))) return "цвет";
  const size = (t: string) => t.match(/\b(\d{2}(?:[.,]\d)?)\s*(?:"|”|INCH)/)?.[1]?.replace(",", ".");
  const sa = size(A);
  const sb = size(B);
  if (sa && sb && Math.round(Number(sa)) !== Math.round(Number(sb))) return "диагональ";
  const hz = (t: string) => t.match(/\b(\d{2,3})\s?HZ\b/)?.[1];
  const ha = hz(A);
  const hb = hz(B);
  if (ha && hb && ha !== hb) return "частота";
  return null;
}
export function modelTokens(raw: string) {
  return new Set(
    raw
      .toUpperCase()
      .replace(/[(),"/”]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/^-+|-+$/g, ""))
      // «VGA+2XHDMI», «HDMI*2+DP» — перечень разъёмов, а не модель; «7TECH00016» — внутренний код Darian
      .filter((w) => w.length >= 5 && /\d/.test(w) && /[A-Z]/.test(w) && !/[+*]/.test(w) && !NOT_MODEL.test(w) && !CPU_TOKEN.test(w)),
  );
}

type Verdict = "same" | "maybe" | "different";

// Бренд по первому слову названия. detectBrand ищет бренд по всему названию и у ноутбуков
// находит производителя процессора («ASUS Vivobook … Intel Core» → Intel), поэтому тут только первое слово.
const firstWord = (s: string) => s.replace(/^\s+/, "").split(/[\s-]+/)[0] ?? "";
function brandWord(s: string) {
  const w = firstWord(s);
  return detectBrand(w) || w;
}

const BRAND_FIX: Record<string, string> = {
  HP: "HP", ASUS: "ASUS", ACER: "Acer", LENOVO: "Lenovo", DELL: "Dell", GIGABYTE: "Gigabyte", SAMSUNG: "Samsung", LG: "LG", MSI: "MSI",
  IMMER: "Immer", ZIFFLER: "Ziffler", EVEREL: "Everel", KEETAB: "Keetab", RULLS: "Rulls", "7TECH": "7Tech", A4TECH: "A4Tech", NETIS: "Netis", WELLCOM: "Wellcom",
};
const titleCase = (w: string) => BRAND_FIX[w.toUpperCase()] ?? (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase());

// Бренд товара Darian: по коду прайса («HP00425» → HP, «ZIFFLER00142» → Ziffler), иначе по первому слову названия
export function darianBrand(code: string, name: string): string | null {
  const prefix = code.replace(/^darian:/, "").match(/^([A-Za-z0-9]*?[A-Za-z])\d{3,}$/)?.[1];
  if (prefix) return titleCase(prefix);
  // у мониторов 7Tech код стоит в конце названия: «7M4S24F100 … NEW 7TECH00019», модели «7M4…»
  if (/\b7TECH\d{3,}|^7M4/i.test(name)) return "7Tech";
  const w = firstWord(name);
  if (!/[A-Za-z]{2,}/.test(w) || /\d{2,}/.test(w)) return null; // «27ZQH100» — название начинается с модели
  return detectBrand(w) || titleCase(w);
}

// Исправление 2026-11-12: у первых товаров Darian бренд определился по процессору (Intel/AMD)
export function fixDarianBrands(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = 'darian_brand_fix_v1'").get()) return;
  const rows = db
    .prepare("SELECT c.id, c.brand, p.code, p.name FROM components c JOIN price_items p ON p.code = c.price_code WHERE p.supplier = 'darian'")
    .all() as { id: number; brand: string | null; code: string; name: string }[];
  const upd = db.prepare("UPDATE components SET brand = ? WHERE id = ?");
  for (const r of rows) {
    const b = darianBrand(r.code, r.name);
    if (b !== r.brand) upd.run(b, r.id);
  }
  db.prepare("INSERT INTO settings(key, value) VALUES ('darian_brand_fix_v1', ?)").run(new Date().toISOString());
}

// Сравнивает две позиции разных прайсов
export function compare(a: string, b: string, kind: "laptop" | "monitor" | "other"): { verdict: Verdict; reason: string } {
  const ba = brandWord(a).toLowerCase();
  const bb = brandWord(b).toLowerCase();
  if (ba !== bb) return { verdict: "different", reason: "бренд" };
  const ta = modelTokens(a);
  const shared = [...modelTokens(b)].filter((x) => ta.has(x));
  if (!shared.length) return { verdict: "different", reason: "модель" };
  const diff = differs(a, b);
  if (diff) return { verdict: "different", reason: diff };
  if (kind !== "laptop") return { verdict: "same", reason: `модель ${shared[0]}` };
  const ca = configOf(a);
  const cb = configOf(b);
  const keys = ["cpu", "ram", "ssd", "gpu"] as const;
  const conflict = keys.filter((k) => ca[k] && cb[k] && ca[k] !== cb[k]);
  if (conflict.length) return { verdict: "different", reason: `другая конфигурация (${conflict.join(", ")})` };
  const known = keys.filter((k) => ca[k] && cb[k]);
  const missing = keys.filter((k) => Boolean(ca[k]) !== Boolean(cb[k]));
  if (known.includes("cpu") && known.includes("ram") && known.includes("ssd") && !missing.length) {
    return { verdict: "same", reason: `модель ${shared[0]}, ${ca.cpu}, ${ca.ram} ГБ, ${ca.ssd} ГБ${ca.gpu ? ", " + ca.gpu : ""}` };
  }
  return { verdict: "maybe", reason: `модель ${shared[0]}; не хватает данных: ${missing.concat(keys.filter((k) => !ca[k] && !cb[k])).join(", ") || "—"}` };
}

// ---------- Раздел и характеристики ----------

function storeGuess(r: DarianRow): { category: string; specs: Record<string, string> } | null {
  const n = r.name;
  if (/MONITOR/i.test(r.sheet)) {
    const g = guessStore(`${n} monitor`);
    return { category: "monitor", specs: g?.specs ?? { type: "Офисный" } };
  }
  if (/ALL IN ONE/i.test(r.sheet)) return { category: "laptop", specs: { type: "Моноблок" } };
  if (/LAPTOP|TABLET/i.test(r.sheet)) {
    const tablet = /\bTB-[A-Z0-9]|\bTAB\b|\bPAD\b|\bP11\b|MATEPAD|GALAXY TAB|IPAD/i.test(n) || /TABLET/i.test(r.sheet);
    return { category: "laptop", specs: { type: tablet ? "Планшет" : "Ноутбук" } };
  }
  // аксессуары. Роутеры (NETIS), жёсткие диски и подставки-кулеры на сайт не выкладываем — остаются только в прайсе
  const sec = (r.section ?? "").toUpperCase();
  if (/^(NETIS|HDD|COOLER)/.test(sec)) return null;
  if (/^DDR/.test(sec)) return { category: "misc", specs: { type: "Память для ноутбука" } };
  // сначала по словам в названии («IMMER KEYBOARD…» стоит в разделе COMBO), потом по заголовку раздела
  const g = guessStore(n);
  if (g) return g;
  const BY_SECTION: [RegExp, string, string][] = [
    [/^K?OMBO|^COMBO/, "periph", "Комплект"],
    [/^MOUSE/, "periph", "Мышь"],
    [/^KEYBOARD/, "periph", "Клавиатура"],
    [/^WEB ?CAM/, "periph", "Веб-камера"],
    [/^HEADSET/, "periph", "Наушники"],
    [/^BAG/, "misc", "Сумка и чехол"],
  ];
  for (const [re, category, type] of BY_SECTION) if (re.test(sec)) return { category, specs: { type } };
  return null;
}

// ---------- Загрузка в базу ----------

export type DarianResult = {
  total: number;
  priced: number;
  created: number;
  updated: number;
  missing: number;
  added: number; // новые товары на сайте
  merged: number; // привязаны к уже существующим товарам (тот же товар у AGE)
  review: number; // отправлены на ручную проверку
  skipped: number; // без раздела — остались только в прайсе
};

export function applyDarian(db: DatabaseSync, rows: DarianRow[], filename: string): DarianResult {
  const res: DarianResult = { total: rows.length, priced: 0, created: 0, updated: 0, missing: 0, added: 0, merged: 0, review: 0, skipped: 0 };
  db.exec("BEGIN");
  try {
    const existing = new Set((db.prepare("SELECT code FROM price_items WHERE supplier = 'darian'").all() as { code: string }[]).map((r) => r.code));
    const upsert = db.prepare(`
      INSERT INTO price_items(code, name, price, stock, in_stock, category, supplier, note, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'darian', ?, datetime('now'))
      ON CONFLICT(code) DO UPDATE SET name = excluded.name, price = excluded.price, stock = excluded.stock,
        in_stock = excluded.in_stock, category = excluded.category, supplier = 'darian', note = excluded.note, updated_at = excluded.updated_at`);
    const seen = new Set<string>();
    for (const r of rows) {
      const code = prefixed("darian", r.code);
      if (seen.has(code)) continue;
      seen.add(code);
      if (r.price) res.priced++;
      // «Раздел прайса» = лист и заголовок раздела: «ACCESSORIES / MOUSE»
      const cat = r.section && r.sheet === "ACCESSORIES" ? `${r.sheet} / ${r.section}` : r.sheet;
      upsert.run(code, r.name, r.price ?? 0, r.note ?? (r.price ? "есть" : "нет цены"), r.price ? 1 : 0, cat, r.note);
      if (existing.has(code)) res.updated++;
      else res.created++;
    }
    // позиции, которых больше нет в прайсе Darian, — нет в наличии (товар на сайте скроется сам: у него нет цены)
    const gone = [...existing].filter((c) => !seen.has(c));
    const off = db.prepare("UPDATE price_items SET in_stock = 0, price = 0, stock = 'нет в прайсе' WHERE code = ?");
    for (const c of gone) off.run(c);
    res.missing = gone.length;

    linkDarian(db, rows, res);
    resolveOffers(db);
    db.prepare(
      "INSERT INTO price_imports(filename, rows_total, rows_new, rows_updated, rows_missing, mapping, supplier) VALUES (?, ?, ?, ?, ?, ?, 'darian')",
    ).run(filename, seen.size, res.created, res.updated, res.missing, JSON.stringify({ added: res.added, merged: res.merged, review: res.review }));
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return res;
}

// Для позиций Darian с ценой: найти тот же товар на сайте (у AGE или уже заведённый из Darian),
// привязать как ещё одно предложение; сомнительные — на проверку; остальные — новый товар на сайте.
function linkDarian(db: DatabaseSync, rows: DarianRow[], res: DarianResult) {
  const linked = new Set((db.prepare("SELECT price_code FROM component_offers").all() as { price_code: string }[]).map((r) => r.price_code));
  const pendingOrRejected = db.prepare("SELECT component_id, status FROM offer_matches WHERE price_code = ?");
  // кандидаты: товары сайта в тех же разделах + названия их позиций в прайсах (у AGE название подробнее)
  const comps = db
    .prepare(
      `SELECT c.id, c.category, c.name, GROUP_CONCAT(p.name, ' || ') AS pnames FROM components c
       LEFT JOIN component_offers o ON o.component_id = c.id LEFT JOIN price_items p ON p.code = o.price_code
       WHERE c.category IN ('laptop', 'monitor', 'periph', 'misc') GROUP BY c.id`,
    )
    .all() as { id: number; category: string; name: string; pnames: string | null }[];
  const addOffer = db.prepare("INSERT OR IGNORE INTO component_offers(component_id, price_code, linked_by) VALUES (?, ?, 'auto')");
  const addMatch = db.prepare("INSERT OR IGNORE INTO offer_matches(price_code, component_id, reason) VALUES (?, ?, ?)");
  const ins = db.prepare("INSERT INTO components(category, name, brand, price_code, specs) VALUES (?, ?, ?, ?, ?)");

  for (const r of rows) {
    const code = prefixed("darian", r.code);
    if (!r.price || linked.has(code)) continue;
    const prior = pendingOrRejected.all(code) as { component_id: number; status: string }[];
    if (prior.some((p) => p.status === "pending")) continue; // ждёт решения
    const rejected = new Set(prior.filter((p) => p.status === "rejected").map((p) => p.component_id));
    const g = storeGuess(r);
    if (!g) {
      res.skipped++;
      continue;
    }
    const kind = g.category === "laptop" ? "laptop" : g.category === "monitor" ? "monitor" : "other";
    let same: number | null = null;
    const maybe: { id: number; reason: string }[] = [];
    for (const c of comps) {
      if (c.category !== g.category || rejected.has(c.id)) continue;
      const names = [c.name, ...(c.pnames ? c.pnames.split(" || ") : [])];
      let best: { verdict: Verdict; reason: string } | null = null;
      for (const n of names) {
        const v = compare(r.name, n, kind);
        if (v.verdict === "same") {
          best = v;
          break;
        }
        if (v.verdict === "maybe" && !best) best = v;
      }
      if (best?.verdict === "same") {
        same = c.id;
        break;
      }
      if (best?.verdict === "maybe") maybe.push({ id: c.id, reason: best.reason });
    }
    if (same != null) {
      addOffer.run(same, code);
      linked.add(code);
      res.merged++;
    } else if (maybe.length) {
      for (const m of maybe.slice(0, 3)) addMatch.run(code, m.id, m.reason);
      res.review++;
    } else {
      const name = prettyName(r.name);
      const id = Number(ins.run(g.category, name, darianBrand(code, r.name), code, JSON.stringify(g.specs)).lastInsertRowid);
      comps.push({ id, category: g.category, name, pnames: r.name });
      linked.add(code);
      res.added++;
    }
  }
}

// Решение по сомнительному совпадению из админки
export function decideMatch(db: DatabaseSync, priceCode: string, componentId: number | null) {
  db.exec("BEGIN");
  try {
    if (componentId != null) {
      // «Это один товар»: позиция становится ещё одним предложением этого товара
      db.prepare("INSERT OR IGNORE INTO component_offers(component_id, price_code, linked_by) VALUES (?, ?, 'manual')").run(componentId, priceCode);
      db.prepare("DELETE FROM offer_matches WHERE price_code = ?").run(priceCode);
    } else {
      // «Разные товары»: больше не предлагать эти пары; позиция станет отдельным товаром при следующей загрузке
      db.prepare("UPDATE offer_matches SET status = 'rejected' WHERE price_code = ?").run(priceCode);
      const p = db.prepare("SELECT name, price, category, note FROM price_items WHERE code = ?").get(priceCode) as
        | { name: string; price: number; category: string | null; note: string | null }
        | undefined;
      if (p && p.price > 0) {
        const [sheet, section] = (p.category ?? "").split(" / ");
        const g = storeGuess({ code: priceCode, name: p.name, price: p.price, sheet, section: section ?? null, note: p.note });
        if (g) {
          const name = prettyName(p.name);
          db.prepare("INSERT INTO components(category, name, brand, price_code, specs) VALUES (?, ?, ?, ?, ?)").run(g.category, name, darianBrand(priceCode, p.name), priceCode, JSON.stringify(g.specs));
        }
      }
    }
    resolveOffers(db);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
