// Ищет фото для товаров без картинки через поиск изображений Bing.
// Берёт крупные изображения на светлом фоне, по возможности — с сайтов производителей и крупных магазинов,
// приводит к единому виду (см. normalize: квадрат 800×800, белый фон, товар по центру с одинаковыми полями)
// и сохраняет в data/uploads. Найденные фото дополнительно складываются в seed-data/photo-patch/ —
// при запуске на сервере они подставятся товарам, у которых фото ещё нет (applyPhotoPatch в src/lib/db.ts).
//
// Запуск: node scripts/fill-photos.mjs [--limit N] [--category laptop] [--relaxed]
//   --relaxed — второй проход для оставшихся: мягче требования к фону и совпадению названия
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { pathToFileURL } from "node:url";
import { findOverride } from "./photo-overrides.mjs";

const ROOT = process.cwd();
const UPLOADS = path.join(ROOT, "data", "uploads");
const PATCH_DIR = path.join(ROOT, "seed-data", "photo-patch");
const PATCH_JSON = path.join(ROOT, "seed-data", "photo-patch.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const LIMIT = Number(arg("--limit") ?? Infinity);
const ONLY = arg("--category");
// --supplier darian — только товары, заведённые из прайса этого поставщика
const SUPPLIER = arg("--supplier");
const RELAXED = process.argv.includes("--relaxed");
// --overrides — искать только товары из scripts/photo-overrides.mjs
const ONLY_OVERRIDES = process.argv.includes("--overrides");

const HINT = {
  cpu: "processor",
  gpu: "graphics card",
  mb: "motherboard",
  ram: "desktop ram dimm",
  ssd: "ssd",
  hdd: "hard drive",
  psu: "power supply",
  case: "pc case",
  cooler: "cpu cooler",
  fan: "case fan",
  monitor: "monitor front view",
  chair: "gaming chair",
};
const TYPE_HINT = {
  Ноутбук: "laptop", Моноблок: "all-in-one pc", Компьютер: "desktop pc", Планшет: "tablet",
  Мышь: "mouse", Клавиатура: "keyboard", Комплект: "keyboard mouse combo", Наушники: "headphones", Микрофон: "microphone",
  Колонки: "speakers", "Веб-камера": "webcam", Геймпад: "gamepad", Кресло: "chair", Стол: "gaming desk",
  "Принтер и МФУ": "printer", Сканер: "scanner", "Картриджи и чернила": "", ИБП: "ups", Проектор: "projector",
  "Экран для проектора": "projection screen", Коврик: "mouse pad", "Сумка и чехол": "", "Док-станция и хаб": "",
  Стилус: "stylus", "Кабель и адаптер": "", "Память для ноутбука": "sodimm", "Внешний диск и привод": "",
  "Флешка и карта памяти": "", "Подставка и кронштейн": "", "Конференц-связь": "", "Проигрыватель винила": "turntable",
};
// сайты производителей и крупных каталогов — их фото обычно чистые, на белом фоне
const GOOD = /(gigabyte\.com|lian-li\.com|jonsbo|msi\.com|asus\.com|deepcool|fsp-group|fsplifestyle|lexar|kingston|samsung|wdc|westerndigital|seagate|toshiba|intel\.com|amd\.com|corsair|thermaltake|montech|id-cooling|idcooling|gamdias|palit|sapphire|tryx|lenovo\.com|hp\.com|dell\.com|acer\.com|logitech|redragon|defender|canon|epson|pantum|xerox|benq|aoc|lg\.com|razer|hyperx|coolermaster|pangoly|newegg|bhphotovideo|amazon|ozon|dns-shop|citilink|regard|mvideo|eldorado|onlinetrade|vseinstrumenti|nix\.ru|icecat)/i;
const BAD = /(infographic|feature|compare|susercontent|shopee|lazada|lazcdn|slatic|tiktok|specsmall|keyfeature|logo|icon|banner|sprite|thumb|avatar|placeholder|youtube|ytimg|pinimg|facebook|instagram|reddit|vk\.com|userapi|aliexpress|alicdn)/i;

// Текст для поиска: без русских слов, служебных пометок и длинных характеристик в скобках
// Процессор: только бренд, серия и модель («Intel Core i5-14400F», «AMD Ryzen 7 7800X3D»),
// без частот, кэша и сокета — иначе «LGA1700» совпадает с фото любого процессора
export function cpuModel(name) {
  const t = name.replace(/[КК]/g, "K");
  const intel = t.match(/\b(i[3579]|ultra\s*[579])[\s-]+(\d{3,5}[a-z]{0,2})\b/i);
  if (intel) return { query: `Intel Core ${intel[1].replace(/\s+/g, " ")}-${intel[2].toUpperCase()}`, model: intel[2].toLowerCase() };
  const amd = t.match(/ryzen\s+(\d)\b.*?\b(\d{4}(?:x3d|xt|x|f|g)?)\b/i);
  if (amd) return { query: `AMD Ryzen ${amd[1]} ${amd[2].toUpperCase()}`, model: amd[2].toLowerCase() };
  return null;
}

function queryName(name, category) {
  if (category === "cpu" && cpuModel(name)) return cpuModel(name).query;
  let n = name;
  if (category === "laptop") {
    const code = n.match(/\(([A-Z0-9#-]{6,})\)\s*$/)?.[1];
    n = n.replace(/\(.*$/, " ") + (code ? ` ${code}` : "");
    // названия Darian без скобок: «HP Laptop 15-FD1133NIA Intel Core 5-120U 8GB …» — модель до процессора
    if (!code) n = n.replace(/\s(Intel|AMD|Core|Ultra|Ryzen|Athlon|Pentium|Celeron|[IR][3579][- ]\d|N\d{3}\b|\d+GB\b).*$/i, " ");
  }
  if (category === "monitor") n = n.replace(/\b(gaming|led)?\s*monitor\b.*$/i, " ").replace(/\d{2}(?:[.,]\d)?["”]/, " ");
  if (category === "office") n = n.replace(/\(.*$/, " ").replace(/<[^>]*>/g, " ").replace(/Диагональ:.*$/i, " ");
  return n
    .replace(/\([^)]*[а-яё][^)]*\)/gi, " ") // «(на количестве 23)»
    .replace(/[а-яё]+[:.]?/gi, " ") // русские слова
    .replace(/\b(oem|box|tray|eu|ru|new)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchBing(q) {
  const r = await fetch(`https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1&qft=+filterui:imagesize-large`, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.8" },
    signal: AbortSignal.timeout(20000),
  });
  const h = await r.text();
  const out = [];
  for (const m of h.matchAll(/ m="(\{.*?\})"/g)) {
    try {
      const j = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
      if (j.murl && /^https?:\/\//.test(j.murl) && !BAD.test(j.murl)) out.push({ url: j.murl, title: `${j.t ?? ""} ${j.purl ?? ""} ${j.murl}` });
    } catch {}
  }
  // Bing иногда перестаёт отдавать картинки (ограничение после частых запросов) — тогда ищем в DuckDuckGo
  return out.length ? out : searchDdg(q);
}

// Поиск картинок DuckDuckGo: на каждый запрос свой ключ vqd (потоки не мешают друг другу),
// при пустом ответе — одна повторная попытка с паузой (сервис иногда притормаживает частые запросы)
async function searchDdg(q, attempt = 0) {
  try {
    const h = await (await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20000) })).text();
    const vqd = (h.match(/vqd=["']?([\d-]+)/) || [])[1];
    let res = [];
    if (vqd) {
      const r = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(q)}&vqd=${vqd}&f=,,,,,&p=1`, {
        headers: { "user-agent": UA, referer: "https://duckduckgo.com/" },
        signal: AbortSignal.timeout(20000),
      });
      if (r.ok) res = ((await r.json()).results || []);
    }
    if (!res.length && attempt < 1) {
      await new Promise((ok) => setTimeout(ok, 2500 + Math.random() * 1500));
      return searchDdg(q, attempt + 1);
    }
    return res
      .filter((x) => x.image && /^https?:\/\//.test(x.image) && !BAD.test(x.image))
      .map((x) => ({ url: x.image, title: `${x.title ?? ""} ${x.url ?? ""} ${x.image}` }));
  } catch {
    return [];
  }
}

// «модельные» слова названия: содержат цифры (C102G, L70, GP550, 5600X, B760M) — хотя бы одно должно быть в описании картинки
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
function modelTokens(q) {
  return [
    ...new Set(
      q
        .split(/[\s,/]+/)
        .filter((w) => /\d/.test(w) && /[a-z]/i.test(w) && w.length >= 3 && !/^(ddr\d|\d+(gb|tb|mhz|hz|w|mm|bit|bits|mb|ms|mc|ms)|\d+in1|v\d)$/i.test(w))
        .map(norm),
    ),
  ];
}
const STOP = new Set(["black", "white", "grey", "gray", "silver", "rgb", "argb", "pro", "plus", "the", "and", "with", "for", "wireless", "wired", "usb", "gaming", "edition"]);
function words(q) {
  return [...new Set(q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 2 && !STOP.has(w)))];
}
const WHITE = /\b(white|wh|snow|silver)\b/i;
function matches(q, title, brand) {
  const t = norm(title);
  const tokens = modelTokens(q);
  if (tokens.length) {
    if (!tokens.some((k) => t.includes(k))) return false;
  } else {
    // в названии нет артикула («Defender Tornado», «HP OMEN citadel»): нужны бренд и почти все слова
    const ws = words(q);
    if (brand && !t.includes(norm(brand))) return false;
    const hit = ws.filter((w) => t.includes(w)).length;
    if (hit < Math.max(2, Math.ceil(ws.length * (RELAXED ? 0.6 : 0.8)))) return false;
  }
  if (WHITE.test(q) && !/white|snow|silver|wh/i.test(title)) return RELAXED;
  if (!WHITE.test(q) && /\b(white|snow)\b/i.test(title) && !/black/i.test(title)) return false;
  return true;
}

async function fetchImage(url) {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, referer: new URL(url).origin + "/" }, signal: AbortSignal.timeout(15000) });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/") || /svg|gif/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 5000 && buf.length < 15e6 ? buf : null;
  } catch {
    return null;
  }
}

// размер подходящий + доля светлого фона по краям (0..1)
async function inspect(buf) {
  try {
    const img = sharp(buf, { failOn: "none" });
    const m = await img.metadata();
    if (!m.width || !m.height || Math.min(m.width, m.height) < 350) return null;
    const ratio = m.width / m.height;
    if (ratio < 0.45 || ratio > 2.3) return null;
    const { data, info } = await sharp(buf, { failOn: "none" }).flatten({ background: "#ffffff" }).resize(40, 40, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    let light = 0;
    let edge = 0;
    for (let y = 0; y < info.height; y++)
      for (let x = 0; x < info.width; x++) {
        if (x > 2 && x < info.width - 3 && y > 2 && y < info.height - 3) continue;
        const i = (y * info.width + x) * info.channels;
        edge++;
        if (data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225) light++;
      }
    // доля тёмных пикселей среди пикселей самого товара (без белого фона)
    let dark = 0;
    let cnt = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (lum > 238) continue;
      cnt++;
      if (lum < 90) dark++;
    }
    return { light: light / edge, dark: cnt > 40 ? dark / cnt : 0, fill: cnt / (info.width * info.height) };
  } catch {
    return null;
  }
}

// доля «непустых» пикселей внутри рамки товара (после обрезки белых полей)
async function density(buf) {
  try {
    const flat = await sharp(buf, { failOn: "none" }).flatten({ background: "#ffffff" }).png().toBuffer();
    const { data, info } = await sharp(flat).trim({ background: "#ffffff", threshold: 20 }).resize(64, 64, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
    let n = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) n++;
    return n / (info.width * info.height);
  } catch {
    return 1;
  }
}

const REJECT_JSON = path.join(ROOT, "data", "photo-reject.json");
const REJECT = fs.existsSync(REJECT_JSON) ? JSON.parse(fs.readFileSync(REJECT_JSON, "utf8")) : {};

const PC = ["case", "cooler", "psu", "fan"];
async function findFor(row) {
  const specs = JSON.parse(row.specs || "{}");
  // сайты, чьи фото для этого товара уже отбраковали при просмотре (data/photo-reject.json: название → хосты)
  const banned = REJECT[row.name] ?? [];
  // ручное уточнение (scripts/photo-overrides.mjs): свой запрос и обязательные слова
  const ov = findOverride(row.name);
  if (!ov && ONLY_OVERRIDES) return null;
  let items;
  if (ov) {
    items = (await searchBing(ov.query)).filter((x) => ov.must.every((w) => norm(x.title).includes(w)) && !banned.includes(new URL(x.url).hostname));
  } else {
    const q = queryName(row.name, row.category);
    if (!modelTokens(q).length && words(q).length < 2) return null; // в названии нет модели — фото не угадать
    const hint = HINT[row.category] ?? TYPE_HINT[specs.type] ?? "";
    const brand = row.brand && !q.toLowerCase().includes(row.brand.toLowerCase()) ? row.brand : "";
    // EXTRA_HINT — своё уточнение поиска для повторного прохода (например «box white background»)
    const query = `${brand} ${q} ${process.env.EXTRA_HINT ?? hint}`.replace(/\s+/g, " ").trim();
    const raw = await searchBing(query);
    items = raw.filter((x) => matches(q, x.title, row.brand) && !banned.includes(new URL(x.url).hostname));
    if (process.env.DEBUG) console.log(`  запрос «${query}»: найдено ${raw.length}, подходят по названию ${items.length}`);
  }
  // настольная память: без фото ноутбучных планок SODIMM
  if (row.category === "ram") items = items.filter((x) => !/so-?dimm|laptop|notebook/i.test(x.title));
  // процессор: ровно эта модель — у «14400» не берём фото «14400F», у «7800X3D» — «7800X» и т. п.
  const cm = row.category === "cpu" ? cpuModel(row.name) : null;
  if (cm) {
    const re = new RegExp(`(^|[^a-z0-9])${cm.model}(?![a-z0-9])`, "i");
    items = items.filter((x) => re.test(x.title.replace(/[-_]/g, " ")) && !/badge|logo|sticker|наклейк/i.test(x.title));
  }
  items = [...items.filter((x) => GOOD.test(x.url)), ...items.filter((x) => !GOOD.test(x.url))].slice(0, 10);
  for (const { url } of items) {
    const buf = await fetchImage(url);
    if (!buf) continue;
    const info = await inspect(buf);
    if (!info || info.light < (RELAXED ? 0.6 : 0.8) || info.fill < 0.04) continue;
    // инфографика и коллажи (товар + надписи по всему полю) — пропускаем, нужен сам товар
    if ((await density(buf)) < 0.22) continue;
    // цвет версии: белая — светлый товар, иначе (корпуса, кулеры, БП) — тёмный
    if (PC.includes(row.category)) {
      if (WHITE.test(row.name) && info.dark > 0.3) continue;
      if (!WHITE.test(row.name) && info.dark < 0.35) continue;
    }
    return { buf, url };
  }
  return null;
}

// Единый вид всех фото: белый фон, обрезаем пустые поля, вписываем товар в квадрат 800×800
// с одинаковым отступом — в карточках все товары одного «размера» и не прыгают по высоте.
export async function normalize(buf) {
  const flat = await sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).png().toBuffer();
  let trimmed = flat;
  try {
    trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 20 }).png().toBuffer();
  } catch {}
  const inner = await sharp(trimmed).resize(704, 704, { fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: 800, height: 800, channels: 3, background: "#ffffff" } })
    .composite([{ input: inner, gravity: "center" }])
    .webp({ quality: 82 })
    .toBuffer();
}

async function save(buf) {
  const out = await normalize(buf);
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.mkdirSync(PATCH_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOADS, name), out);
  fs.copyFileSync(path.join(UPLOADS, name), path.join(PATCH_DIR, name));
  return name;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const db = new DatabaseSync(path.join(ROOT, "data", "shop.db"));
  const rows = db
    .prepare(
      `SELECT id, name, brand, category, specs FROM components WHERE active = 1 AND (image IS NULL OR image = '') ${ONLY ? "AND category = ?" : ""}
       ${SUPPLIER ? `AND price_code LIKE '${SUPPLIER.replace(/[^a-z]/g, "")}:%'` : ""} ORDER BY category, id`,
    )
    .all(...(ONLY ? [ONLY] : []))
    .slice(0, LIMIT);
  const patch = fs.existsSync(PATCH_JSON) ? JSON.parse(fs.readFileSync(PATCH_JSON, "utf8")) : {};
  const upd = db.prepare("UPDATE components SET image = ?, image_checked = 1 WHERE id = ?");
  let ok = 0;
  let miss = 0;
  const queue = [...rows];
  const flush = () => fs.writeFileSync(PATCH_JSON, JSON.stringify(patch, null, 1));

  async function worker() {
    while (queue.length) {
      const row = queue.shift();
      try {
        const found = await findFor(row);
        if (found) {
          const file = await save(found.buf);
          upd.run(`/uploads/${file}`, row.id);
          patch[row.name] = file;
          ok++;
          if (ok % 20 === 0) flush();
          console.log(`✓ ${row.category} ${row.name.slice(0, 60)}  ← ${new URL(found.url).hostname}`);
        } else {
          miss++;
          console.log(`✗ ${row.category} ${row.name.slice(0, 60)}`);
        }
      } catch (e) {
        miss++;
        console.log(`! ${row.name.slice(0, 60)}: ${e.message}`);
      }
      // пауза между товарами; DELAY_MS=10000 — «медленный режим», чтобы поисковик не включал проверку «не робот»
      await new Promise((r) => setTimeout(r, Number(process.env.DELAY_MS ?? 300)));
    }
  }

  // WORKERS=1 — по одному товару за раз (вместе с DELAY_MS для медленного режима)
  await Promise.all(Array.from({ length: Math.max(1, Number(process.env.WORKERS ?? 3)) }, () => worker()));
  flush();
  console.log(`\nГотово: найдено ${ok}, не найдено ${miss}, всего в патче ${Object.keys(patch).length}`);
}
