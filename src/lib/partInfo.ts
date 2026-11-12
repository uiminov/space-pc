// Разбор строки прайса AGE: бренд, характеристики для совместимости и «чистое» название для сайта.
import { guessStore, STORE_KEYS } from "./storeCats";

const BRANDS = [
  // техника и периферия (идут первыми: «HP», «Lenovo» и т. п. стоят в начале названия)
  "Titan Army", "Audio-Technica", "HyperX", "DXRacer", "Lenovo", "Acer", "Dell", "Apple", "LG", "AOC", "BenQ", "Pixel", "Redmi",
  "Xiaomi", "Logitech", "Razer", "A4Tech", "Rapoo", "Genius", "Canon", "Pantum", "Epson", "Xerox", "Panasonic", "Defender",
  "Premier", "Koss", "AULA", "Huawei", "Vissonic", "CZUR", "HP",
  "MSI", "Gigabyte", "AORUS", "ASUS", "ASRock", "Maxsun", "Palit", "Zotac", "Inno3D", "PNY", "Sapphire", "Manli",
  "OCPC", "Arktek", "Axle", "Peladin", "DeepCool", "Lian Li", "Montech", "FSP", "Thermaltake", "Cooler Master",
  "Jonsbo", "ID-Cooling", "TRYX", "Gamdias", "PowerCase", "Kingston", "Samsung", "Lexar", "Hiksemi", "Teamgroup",
  "Corsair", "KingBank", "Adata", "Apacer", "Crucial", "WD", "Seagate", "Toshiba", "Gembird", "Aerocool", "Redragon",
  "Zalman", "Hikvision", "Transcend", "AGI", "GMOC", "Netac", "Sharkoon", "Patriot", "Kingfast", "Adlink",
  "Intel", "AMD",
];

const ALIASES: Record<string, string> = { "Hiksema": "Hiksemi", "ID Cooling": "ID-Cooling", "CoolerMaster": "Cooler Master", "Deepcool": "DeepCool" };

export function detectBrand(name: string): string | null {
  const n = name.replace(/\s+/g, " ");
  for (const [a, b] of Object.entries(ALIASES)) if (new RegExp(`(^|[^a-z])${a}([^a-z]|$)`, "i").test(n)) return b;
  for (const b of BRANDS) {
    const re = new RegExp(`(^|[^a-z])${b.replace(/[ -]/g, "[ -]?")}([^a-z]|$)`, "i");
    if (re.test(n)) return b === "AORUS" ? "Gigabyte" : b;
  }
  if (/^(Toughpower|Litepower)/i.test(n)) return "Thermaltake";
  if (/^(APX|Century|HydroShift)/i.test(n)) return "Montech";
  if (/^(PW|PB|PG)\d{3,4}/i.test(n)) return "PowerCase";
  if (/^(ATH-|AT-LP)/i.test(n)) return "Audio-Technica";
  if (/^(KPH|KSC|KTXPRO|UR\d|BT\d{3}i|Pro4S|SB40|CS\d{3}|GMR\d|TD85|Porta Pro|Plug Wireless|UTILITY)/i.test(n)) return "Koss";
  if (/macbook|imac|mac mini/i.test(n)) return "Apple";
  return null;
}

// Можно ли добавить позицию прайса на сайт автоматически:
// комплектующие для сборки и товары новых разделов (техника, периферия, мебель, мелочи)
export function isConfigurable(category: string, name: string) {
  const t = name.toLowerCase();
  if (STORE_KEYS.includes(category)) return true;
  if (!["cpu", "mb", "ram", "gpu", "ssd", "hdd", "psu", "case", "cooler", "fan"].includes(category)) return false;
  if (/(sodimm|sodim|so-dimm|ext |внешн|portable|bracket|кронштейн|riser|рамка|брикет|термопаст|thermal paste|hard case|кабель|cable|extension)/.test(t)) return false;
  if (category === "case" && /(\+ ?бп|с бп|c бп)/.test(t)) return true;
  return true;
}

const num = (s?: string) => (s ? parseInt(s, 10) : 0);

function cpuTdp(t: string): string {
  if (/9950x3d|9900x3d|9950x|7950x/.test(t)) return "170";
  if (/x3d/.test(t)) return "120";
  if (/i9|ultra 9/.test(t)) return "125";
  if (/(\d{4,5})kf?\b|-\d{3}kf?\b|\d{3}k\b/.test(t)) return "125";
  if (/ryzen.*\d{4}x\b/.test(t)) return "105";
  if (/i3/.test(t)) return "60";
  return "65";
}

const GPU_TDP: [RegExp, number][] = [
  [/5090/, 575], [/5080/, 360], [/5070\s?ti/, 300], [/5070/, 250], [/5060\s?ti/, 180], [/5060/, 145], [/5050/, 130],
  [/4090/, 450], [/4080/, 320], [/4070\s?ti/, 285], [/4070/, 200], [/4060\s?ti/, 165], [/4060/, 115],
  [/3090/, 350], [/3080/, 320], [/3070/, 220], [/3060\s?ti/, 200], [/3060/, 170], [/3050/, 130],
  [/2060/, 175], [/1660/, 125], [/1650/, 75], [/1050/, 75], [/gt\s?1030|gt\s?730|gt\s?710/, 30],
  [/9070\s?xt/, 304], [/9070/, 220], [/9060/, 160], [/7900/, 315], [/7800/, 263], [/7700/, 245], [/7600/, 165],
  [/rx\s?6\d{3}/, 180], [/rx\s?580/, 185], [/rx\s?550/, 50],
];

function mbSocket(t: string): string | undefined {
  if (/lga\s?1851|\b(b860|h810|z890|b8\d0m?)\b/.test(t) && !/\bam5\b|b850|b840/.test(t)) return "LGA1851";
  if (/lga\s?1700|\b(h610|b660|b760|h770|z690|z790)/.test(t)) return "LGA1700";
  if (/\bam5\b|\b(a620|b650|b840|b850|x670|x870)/.test(t)) return "AM5";
  if (/\bam4\b|\b(a520|b450|b550|x570)/.test(t)) return "AM4";
  return undefined;
}

export function guessSpecs(category: string, raw: string): Record<string, string> {
  const name = raw.replace(/\s+/g, " ");
  const t = name.toLowerCase();
  const s: Record<string, string> = {};
  if (STORE_KEYS.includes(category)) return guessStore(raw)?.specs ?? {};
  switch (category) {
    case "cpu": {
      const sock = t.match(/lga\s?(1851|1700|1200)|\b(am5|am4)\b/);
      if (sock) s.socket = sock[1] ? `LGA${sock[1]}` : sock[2].toUpperCase();
      const c = t.match(/(\d+)\s*cores?\s*\/\s*(\d+)\s*threads?/);
      if (c) s.cores = `${c[1]}/${c[2]}`;
      s.tdp = cpuTdp(t);
      if (/amd|ryzen/.test(t)) s.igpu = /no gpu/.test(t) ? "нет" : /\bgpu\b/.test(t) ? "да" : "нет";
      else s.igpu = /\d{3,5}kf\b|\d{3,5}f\b|-\d{3}kf\b|-\d{3}f\b/.test(t) ? "нет" : "да";
      break;
    }
    case "mb": {
      const sock = mbSocket(t);
      if (sock) s.socket = sock;
      const ram = t.match(/\b(d4|d5|ddr4|ddr5)\b/);
      s.ram_type = ram ? (ram[1].endsWith("4") ? "DDR4" : "DDR5") : sock === "AM4" ? "DDR4" : "DDR5";
      const chip = t.match(/\b([abhxz]\d{3,4})([mi])?\b/);
      s.form_factor = /mini-?itx|\bitx\b/.test(t) || chip?.[2] === "i" ? "ITX" : chip?.[2] === "m" || /m-?atx|matx/.test(t) ? "mATX" : "ATX";
      break;
    }
    case "ram": {
      const ty = t.match(/ddr\s?([345])/);
      if (ty) s.ram_type = `DDR${ty[1]}`;
      const cap = name.match(/(\d+)\s?GB/i);
      const kit = name.match(/\((\d+)\s?\*\s?(\d+)\)|(\d+)\s?GB\s?\*\s?(\d+)/i);
      if (cap) s.capacity = `${cap[1]} ГБ${kit ? ` (${kit[1] ? `${kit[1]}×${kit[2]}` : `${kit[4]}×${kit[3]}`})` : ""}`;
      const sp = t.match(/(\d{4})\s?mhz/);
      if (sp) s.speed = `${sp[1]} МГц`;
      break;
    }
    case "gpu": {
      const v = name.match(/(\d+)\s?GB/i);
      if (v) s.vram = `${v[1]} ГБ`;
      const tdp = GPU_TDP.find(([re]) => re.test(t));
      if (tdp) s.tdp = String(tdp[1]);
      break;
    }
    case "ssd":
    case "hdd": {
      const tb = name.match(/(\d+(?:[.,]\d+)?)\s?TB/i);
      const gb = name.match(/(\d{3,4})\s?GB/i);
      if (tb) s.capacity = `${tb[1].replace(",", ".")} ТБ`;
      else if (gb) s.capacity = num(gb[1]) >= 1000 ? `${num(gb[1]) / 1000} ТБ` : `${gb[1]} ГБ`;
      break;
    }
    case "psu": {
      const w = name.match(/(\d{3,4})\s?(?:W\b|Watt|Вт)/i) || name.match(/\b[A-Z]{1,4}(\d{3,4})[A-Z]{0,3}\b/);
      if (w && num(w[1]) >= 300 && num(w[1]) <= 2000) s.wattage = w[1];
      const cert = name.match(/80\s?(?:\+|plus)\s?(white|bronze|silver|gold|platinum|titanium|standard)?/i);
      if (cert) s.cert = `80+${cert[1] ? ` ${cert[1][0].toUpperCase()}${cert[1].slice(1).toLowerCase()}` : ""}`;
      break;
    }
    case "case": {
      if (/e-?atx/.test(t)) s.form_factor = "E-ATX, ATX, mATX, ITX";
      else if (/mini-?itx|\bitx\b/.test(t) && !/atx/.test(t.replace(/itx/g, ""))) s.form_factor = "ITX";
      else if (/m-?atx|matx|micro|микро/.test(t)) s.form_factor = "mATX, ITX";
      else s.form_factor = "ATX, mATX, ITX";
      break;
    }
    case "cooler": {
      const r = t.match(/(120|240|280|360|420)\s?(mm)?/);
      if (/водян|liquid|сжо|aio|ls\d{3}|lt\d{3}|lq\d{3}|le\d{3}|lm\d{3}|coreliquid|dashflow|pinkflow|fx\d{3}|sl\d{3}/.test(t))
        s.type = `СЖО${r ? ` ${r[1]}` : ""}`;
      else s.type = "Башня";
      break;
    }
  }
  return s;
}

// Название для сайта: без служебных префиксов и пометок поставщика
export function cleanName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^(MB|Корпус|Кулер|Водяной кулер|Блок питание|Блок питания|Case|Fan)\s*-?\s*/i, "")
    .replace(/^SSD\s+(M\.?2\s+)?/i, "SSD ")
    .replace(/\((?:можно|support)[^)]*\)/gi, "")
    .replace(/\((?:распродажа|маркировк[аи]|витрина|сервис[^)]*|\d+\s*штук[аи]?|новинка|опт[^)]*|продажа[^)]*)\)/gi, "")
    .replace(/\s+-\s+/g, " ")
    .replace(/™|®/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
