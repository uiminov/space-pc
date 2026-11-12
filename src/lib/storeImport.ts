import type { DatabaseSync } from "node:sqlite";
import { guessCategory } from "./catalog";
import { cleanName, detectBrand, guessSpecs } from "./partInfo";
import { STORE_KEYS } from "./storeCats";

// Новые разделы каталога (ноутбуки, мониторы, аксессуары, кресла, оргтехника, мелочи):
// один раз при запуске добавляем на сайт позиции прайса AGE, которые есть в наличии
// и ещё не заведены. Дальше ими можно управлять в админке как обычными товарами.
const MARK = "store_import_v1";

export function importStoreItems(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = ?").get(MARK)) return;
  const items = db
    .prepare(
      `SELECT p.code, p.name FROM price_items p
       WHERE p.in_stock = 1 AND p.price > 0 AND NOT EXISTS (SELECT 1 FROM components c WHERE c.price_code = p.code)`,
    )
    .all() as { code: string; name: string }[];
  const ins = db.prepare("INSERT INTO components(category, name, brand, price_code, specs) VALUES (?, ?, ?, ?, ?)");
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const it of items) {
      const cat = guessCategory(it.name);
      if (!STORE_KEYS.includes(cat)) continue;
      ins.run(cat, cleanName(it.name), detectBrand(it.name), it.code, JSON.stringify(guessSpecs(cat, it.name)));
      added++;
    }
    db.prepare("INSERT INTO settings(key, value) VALUES (?, ?)").run(MARK, `${new Date().toISOString()} +${added}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Позиции, у которых в прайсе AGE нет бренда в названии («TEN (B)», «View 71TG Snow»…) или
// категорию не угадать по словам. Бренд — по листу прайса, где стоит позиция.
// [шаблон названия, бренд для сайта (добавляется в начало названия), категория, тип]
type Rule = [RegExp, string | null, string, string?];
const RULES: Rule[] = [
  // Montech
  [/^(TEN|X2 PLUS|XR|X3 (GLASS|MESH)|X5|TG3( Curved)?|AIR 903 MAX|KING ?\d+ PRO)\b/i, "Montech", "case"],
  [/^(PureFlow|HyperFlow)\b.*360/i, "Montech", "cooler", "СЖО 360"],
  [/^GMP \d{3}/i, "Montech", "misc", "Коврик"],
  // Thermaltake
  [/^Litepower/i, "Thermaltake", "psu"],
  [/^(Versa|S200|S250|V350|TT Premium|Commander|View ?\d|Divider)/i, "Thermaltake", "case"],
  // Cooler Master
  [/^Elite V3 \d+W/i, "Cooler Master", "psu"],
  [/^(CMP510|COSMOS|MasterFrame|H500|TD500|Q500|CP520)\b/i, "Cooler Master", "case"],
  [/^Devastator/i, "Cooler Master", "periph", "Комплект"],
  [/^MLW-/i, "Cooler Master", "cooler", "СЖО 240"],
  // PowerCase
  [/^ZAC0\d/i, "PowerCase", "cooler", "Башня"],
  [/^(PL-A-360|Xi360D)/i, "PowerCase", "cooler", "СЖО 360"],
  [/^(Mistral|ByteFlow)\b/i, "PowerCase", "case"],
  // Jonsbo
  [/^Jonsbo UMX/i, null, "case"],
  [/^Jonsbo Fan\b/i, null, "fan"],
  [/^Jonsbo (TG|TF)[ -]?360/i, null, "cooler", "СЖО 360"],
  [/^Jonsbo (CR-|HX\d|PISA)/i, null, "cooler", "Башня"],
  // Lian Li
  [/^Lian Li Strimer/i, null, "misc", "Кабель и адаптер"],
  [/^Lian Li .*Bracket/i, null, "misc", "Аксессуары для ПК"],
  [/^Lian Li Reverse/i, null, "fan"],
  [/^Lian Li GA II Trinity 240/i, null, "cooler", "СЖО 240"],
  // ID-Cooling
  [/^ID Cooling Брикет/i, null, "misc", "Аксессуары для ПК"],
  [/^ID Cooling (FX|DX|SL)360/i, null, "cooler", "СЖО 360"],
  [/^ID Cooling (SE-|BLITZ|DK-)/i, null, "cooler", "Башня"],
  // Вентиляторы, записанные по-русски («Вентелятор Deepcool FL12»)
  [/^(Вент[еи]лятор|Fan\s*-)/i, null, "fan"],
  // Периферия, кресла, ВКС
  [/^Lenovo Legion K\d/i, null, "periph", "Клавиатура"],
  [/^Lenovo IdeaPad Gaming H\d/i, null, "periph", "Наушники"],
  [/^Lenovo Legion S600/i, null, "misc", "Коврик"],
  [/^HP OMEN Sequencer/i, null, "periph", "Клавиатура"],
  [/^HP 125 WRD/i, null, "periph", "Мышь"],
  [/(Admiral|OMEN citadel|MAG CH120|AULA F8093)/i, null, "chair", "Кресло"],
  [/^AT-LP\d/i, "Audio-Technica", "periph", "Проигрыватель винила"],
  [/(Vissonic|Aver FONE|Teleset TCM)/i, null, "office", "Конференц-связь"],
];

const MARK2 = "catalog_import_v2";

// Второй проход: всё, что есть в прайсе в наличии, но ещё не попало на сайт
// (вентиляторы, корпуса и кулеры без бренда в названии и т. п.)
export function importAllLeftovers(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = ?").get(MARK2)) return;
  const items = db
    .prepare(
      `SELECT p.code, p.name FROM price_items p
       WHERE p.in_stock = 1 AND p.price > 0 AND NOT EXISTS (SELECT 1 FROM components c WHERE c.price_code = p.code)`,
    )
    .all() as { code: string; name: string }[];
  const ins = db.prepare("INSERT INTO components(category, name, brand, price_code, specs) VALUES (?, ?, ?, ?, ?)");
  let added = 0;
  db.exec("BEGIN");
  try {
    for (const it of items) {
      const g = classify(it.name);
      if (!g) continue;
      ins.run(g.category, g.name, g.brand, it.code, JSON.stringify(g.specs));
      added++;
    }
    db.prepare("INSERT INTO settings(key, value) VALUES (?, ?)").run(MARK2, `${new Date().toISOString()} +${added}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Исправление старой сортировки (2026-11-11): SSD Gigabyte AORUS попали в «Охлаждение»
// (артикул AG4… похож на кулер Deepcool AG400), вентиляторы Lian Li записаны в прайсе как «… Cooler»,
// корпус Deepcool CL6600 продаётся с СЖО. Переносим по названию — одинаково локально и на сервере.
const MARK3 = "recategorize_v1";

export function recategorize(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = ?").get(MARK3)) return;
  const rows = db.prepare("SELECT id, category, name FROM components").all() as { id: number; category: string; name: string }[];
  const upd = db.prepare("UPDATE components SET category = ?, name = ?, specs = ? WHERE id = ?");
  let moved = 0;
  db.exec("BEGIN");
  try {
    for (const r of rows) {
      let to: [string, string, Record<string, string>] | null = null;
      if (r.category === "cooler" && /^SSD\b/i.test(r.name)) to = ["ssd", r.name, guessSpecs("ssd", r.name)];
      else if (r.category === "cooler" && /^Lian Li (SL120|AL120|SL-INF|P28|AL140|TL120|TLLCD)/i.test(r.name)) {
        const name = r.name.replace(/\s+Cooler$/i, "");
        to = ["fan", name, { type: /-3[BW]?\b|\b120-3\b/i.test(r.name) ? "Комплект 3 шт." : "1 шт." }];
      } else if (r.category === "cooler" && /GC-F009/i.test(r.name)) to = ["fan", r.name, { type: "Комплект 3 шт." }];
      else if (r.category === "cooler" && /CL6600/i.test(r.name)) to = ["case", r.name, guessSpecs("case", r.name)];
      // ноутбук в комплекте с сумкой («… + сумка») попал в «Мелочи»
      else if (r.category === "misc" && /\(.*(core|ryzen|snapdragon).*ssd.*\)/i.test(r.name)) to = ["laptop", r.name, { type: "Ноутбук" }];
      if (!to) continue;
      upd.run(to[0], to[1], JSON.stringify(to[2]), r.id);
      moved++;
    }
    db.prepare("INSERT INTO settings(key, value) VALUES (?, ?)").run(MARK3, `${new Date().toISOString()} ${moved}`);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Вторая правка сортировки (2026-11-11): в «Ноутбуках» оказались сканеры Panasonic
// («…планшет…» в описании), рюкзаки HP («Laptop Bckpck») и подставки под ноутбук.
const MARK4 = "recategorize_v2";

export function recategorize2(db: DatabaseSync) {
  if (db.prepare("SELECT 1 FROM settings WHERE key = ?").get(MARK4)) return;
  const rows = db.prepare("SELECT id, category, name FROM components WHERE category = 'laptop'").all() as { id: number; category: string; name: string }[];
  const upd = db.prepare("UPDATE components SET category = ?, specs = ? WHERE id = ?");
  let moved = 0;
  for (const r of rows) {
    const t = r.name.toLowerCase();
    // настоящий ноутбук (в т. ч. «… + сумка» в комплекте) не трогаем
    if (/\(.*(core|ryzen|snapdragon|athlon|pentium).*ssd.*\)/i.test(r.name)) continue;
    let to: [string, string] | null = null;
    if (/сканер|scanner/.test(t)) to = ["office", "Сканер"];
    else if (/bckpck|backpack|рюкзак|сумк|sleeve/.test(t)) to = ["misc", "Сумка и чехол"];
    else if (/подставк|laptop stand|\bstand\b/.test(t)) to = ["misc", "Подставка и кронштейн"];
    if (!to) continue;
    upd.run(to[0], JSON.stringify({ type: to[1] }), r.id);
    moved++;
  }
  db.prepare("INSERT INTO settings(key, value) VALUES (?, ?)").run(MARK4, `${new Date().toISOString()} ${moved}`);
}

export function classify(raw: string): { category: string; name: string; brand: string | null; specs: Record<string, string> } | null {
  const src = raw.replace(/\s+/g, " ").trim();
  const rule = RULES.find(([re]) => re.test(src));
  const category: string = rule?.[2] ?? guessCategory(src);
  if (category === "other") return null;
  // длинные описания ВКС-оборудования: оставляем модель, характеристики — в прайсе
  let name = cleanName(src.replace(/\s+Камера:.*$/i, "").replace(/^Вент[еи]лятор\s+/i, "Вентилятор ").replace(/^(ПК Кейс|БП)\s+/i, ""));
  // «(B)», «(W)», «(R)» — так в прайсе Montech записан цвет
  name = name.replace(/\s*\(B\)/g, " Black").replace(/\s*\(W\)/g, " White").replace(/\s*\(R\)/g, " Red");
  if (rule?.[1] && !name.toLowerCase().startsWith(rule[1].toLowerCase())) name = `${rule[1]} ${name}`;
  if (/^(Вентилятор|Fan)/i.test(name) && category === "fan") name = name.replace(/^(Вентилятор|Fan)\s+/i, "");
  const brand = rule?.[1] ?? detectBrand(name);
  const specs = STORE_KEYS.includes(category) || category === "fan" ? {} : guessSpecs(category, name);
  if (rule?.[3]) specs.type = rule[3];
  if (category === "fan") {
    specs.type = /3\s?-?in\s?-?1|-3\b|360|\b3 ?pack/i.test(src) ? "Комплект 3 шт." : "1 шт.";
  }
  if (!rule && STORE_KEYS.includes(category)) Object.assign(specs, guessSpecs(category, src));
  return { category, name, brand, specs };
}
