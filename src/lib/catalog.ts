// Справочники, общие для клиента и сервера.
import { guessStore, STORE_CATEGORIES } from "./storeCats";

export const CATEGORIES = [
  { key: "cpu", label: "Процессор", short: "CPU" },
  { key: "cooler", label: "Охлаждение", short: "Кулер" },
  { key: "mb", label: "Материнская плата", short: "Плата" },
  { key: "ram", label: "Оперативная память", short: "RAM" },
  { key: "gpu", label: "Видеокарта", short: "GPU" },
  { key: "ssd", label: "Накопитель SSD", short: "SSD" },
  { key: "hdd", label: "Жёсткий диск", short: "HDD" },
  { key: "psu", label: "Блок питания", short: "БП" },
  { key: "case", label: "Корпус", short: "Корпус" },
  { key: "fan", label: "Вентиляторы", short: "Вент." },
  // техника, периферия, мебель и мелочи (не участвуют в конфигураторе)
  ...STORE_CATEGORIES,
  { key: "other", label: "Прочее", short: "Прочее" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const REQUIRED_CATEGORIES: CategoryKey[] = ["cpu", "mb", "ram", "ssd", "psu", "case"];

export function categoryLabel(key: string) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

export const PURPOSES = [
  { key: "gaming", label: "Игровые" },
  { key: "stream", label: "Для стрима" },
  { key: "work", label: "Для работы и 3D" },
  { key: "office", label: "Офисные" },
] as const;

export function purposeLabel(key: string) {
  return PURPOSES.find((p) => p.key === key)?.label ?? key;
}

// Какие характеристики можно указать для каждой категории (используются в проверке совместимости).
export const SPEC_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  cpu: [
    { key: "socket", label: "Сокет", placeholder: "AM5 / LGA1700" },
    { key: "cores", label: "Ядра/потоки", placeholder: "8/16" },
    { key: "tdp", label: "TDP, Вт", placeholder: "120" },
    { key: "igpu", label: "Встроенная графика (да/нет)", placeholder: "нет" },
  ],
  mb: [
    { key: "socket", label: "Сокет", placeholder: "AM5" },
    { key: "ram_type", label: "Тип памяти", placeholder: "DDR5" },
    { key: "form_factor", label: "Форм-фактор", placeholder: "ATX / mATX" },
  ],
  ram: [
    { key: "ram_type", label: "Тип памяти", placeholder: "DDR5" },
    { key: "capacity", label: "Объём", placeholder: "32 ГБ (2×16)" },
    { key: "speed", label: "Частота", placeholder: "6000 МГц" },
  ],
  gpu: [
    { key: "vram", label: "Видеопамять", placeholder: "16 ГБ" },
    { key: "tdp", label: "Потребление, Вт", placeholder: "300" },
  ],
  ssd: [{ key: "capacity", label: "Объём", placeholder: "1 ТБ" }],
  hdd: [{ key: "capacity", label: "Объём", placeholder: "2 ТБ" }],
  psu: [
    { key: "wattage", label: "Мощность, Вт", placeholder: "750" },
    { key: "cert", label: "Сертификат", placeholder: "80+ Gold" },
  ],
  case: [{ key: "form_factor", label: "Поддержка плат", placeholder: "ATX, mATX" }],
  cooler: [{ key: "type", label: "Тип", placeholder: "Башня / СЖО 360" }],
  fan: [],
  laptop: [{ key: "type", label: "Тип", placeholder: "Ноутбук / Моноблок" }],
  monitor: [
    { key: "type", label: "Тип", placeholder: "Игровой / Офисный" },
    { key: "size", label: "Диагональ", placeholder: '27"' },
    { key: "hz", label: "Частота", placeholder: "240 Гц" },
    { key: "res", label: "Разрешение", placeholder: "QHD" },
  ],
  periph: [{ key: "type", label: "Тип", placeholder: "Мышь / Клавиатура / Наушники" }],
  chair: [{ key: "type", label: "Тип", placeholder: "Кресло / Стол" }],
  office: [{ key: "type", label: "Тип", placeholder: "Принтер и МФУ / Сканер / ИБП" }],
  misc: [{ key: "type", label: "Тип", placeholder: "Коврик / Сумка и чехол / Кабель и адаптер" }],
  other: [],
};

export const ORDER_STATUSES = [
  { key: "new", label: "Новый" },
  { key: "contacted", label: "Связались" },
  { key: "paid", label: "Оплачен" },
  { key: "assembling", label: "Собирается" },
  { key: "done", label: "Выдан" },
  { key: "cancelled", label: "Отменён" },
] as const;

export function statusLabel(key: string) {
  return ORDER_STATUSES.find((s) => s.key === key)?.label ?? key;
}

// Категория по названию позиции прайса (для прайсов без разделов, например лист Export у AGE UZ)
export function guessCategory(raw: string): CategoryKey {
  const t = raw.toLowerCase();
  if (/^mb\s/.test(t)) return "mb";
  // «SSD Gigabyte … AORUS (AG470E1TB)» — артикул похож на кулер AG400, поэтому SSD проверяем раньше
  if (/^ssd\s/.test(t)) return "ssd";
  // вентиляторы Lian Li записаны в прайсе как «… Cooler»
  if (/^lian li (sl120|al120|sl-inf|p28|al140|tl120|tllcd)/.test(t)) return "fan";
  // комплектующие, записанные в прайсе по-русски с опечатками и без англ. слов
  if (/^вент[еи]лятор/.test(t)) return "fan";
  if (/^бп\s/.test(t)) return "psu";
  if (/^пк кейс/.test(t)) return "case";
  // ноутбуки, мониторы, периферия, мебель, оргтехника, мелочи
  const store = guessStore(raw);
  if (store) return store.category;
  // готовые ноутбуки, моноблоки и ПК: «Модель (CPU/ DDR5 16GB/ SSD 512GB/ …)»
  if (/\(.*\/\s*(lp)?ddr\d?x?\s*\d+\s*gb.*\/\s*ssd/i.test(t) || /(desktop|omnidesk|vivobook|thinkpad|ideapad|thinkbook|zenbook)/.test(t)) return "other";
  if (/(ноутбук|notebook|laptop|macbook|mac mini|моноблок|all in one|aio pc|монитор|monitor|принтер|мфу|сканер|printer|scanner|проектор|экран|камера|webcam|клавиатур|keyboard|мыш|mouse|коврик|наушник|headset|гарнитур|акустик|колонк|микрофон|кресло|chair|сумк|рюкзак|чехол|картридж|тонер|ups|ибп|бесперебой|сетевой фильтр|удлинит|кабель|cable|adapter|адаптер|роутер|router|ath-|at-lp|ext hdd|ext ssd|portable|внешн|dvd|флеш|flash|usb.?hub|интерактив|видеостен|панель|джойстик|геймпад|руль)/.test(t))
    return "other";
  if (/\bfan\b/.test(t) && !/(блок питани|power supply|корпус|кейс|case|кулер|cooler|сжо|liquid|водян)/.test(t)) return "fan";
  if (/(блок питани|power supply|psu\b|\b\d{3,4}\s?w\b.*(80|gold|bronze|platinum|white|modular)|80\s?\+|80 plus)/.test(t)) return "psu";
  if (/(водян|liquid|сжо|aio\b|кулер|куллер|cooler|охлажд|frozn|ak\d{3}|ag\d{3}|dashflow|pinkflow|coreliquid)/.test(t)) return "cooler";
  if (/(вентилятор|\bfan\b|fans pack)/.test(t) && !/корпус|case/.test(t)) return "fan";
  if (/(корпус|\bcase\b|lancool|o11|tower|chassis)/.test(t)) return "case";
  if (/(intel-?core|core\s?i[3579]|core ultra|ryzen|athlon|celeron|pentium|xeon|processor|процессор)/.test(t) && !/(mb |материнск|motherboard)/.test(t)) return "cpu";
  if (/(geforce|radeon|rtx\s?\d|gtx\s?\d|rx\s?\d{4}|arc a\d|видеокарт|video card)/.test(t)) return "gpu";
  if (/(^mb |материнск|motherboard|mainboard)/.test(t)) return "mb";
  if (/(ssd|nvme|m\.2)/.test(t)) return "ssd";
  if (/(hdd|жестк|жёстк|hard drive|barracuda|wd blue|wd purple|skyhawk|ironwolf)/.test(t)) return "hdd";
  if (/(ddr\d|dimm|so-?dimm|оперативн|память|memory)/.test(t)) return "ram";
  return "other";
}

// Раздел «Комплектующие» (продажа по отдельности)
export const PART_CATEGORIES = [
  { key: "cpu", title: "Процессоры" },
  { key: "gpu", title: "Видеокарты" },
  { key: "mb", title: "Материнские платы" },
  { key: "ram", title: "Оперативная память" },
  { key: "ssd", title: "SSD-накопители" },
  { key: "hdd", title: "Жёсткие диски" },
  { key: "psu", title: "Блоки питания" },
  { key: "case", title: "Корпуса" },
  { key: "cooler", title: "Охлаждение" },
  { key: "fan", title: "Вентиляторы" },
  { key: "laptop", title: "Ноутбуки и моноблоки" },
  { key: "monitor", title: "Мониторы" },
  { key: "periph", title: "Аксессуары" },
  { key: "chair", title: "Кресла и столы" },
  { key: "office", title: "Принтеры и оргтехника" },
  { key: "misc", title: "Мелочи" },
] as const;

// Группы разделов на витрине: комплектующие ПК и остальная техника
export const PART_GROUPS = [
  { key: "pc", cats: ["cpu", "gpu", "mb", "ram", "ssd", "hdd", "psu", "case", "cooler", "fan"] },
  { key: "tech", cats: ["laptop", "monitor", "periph", "chair", "office", "misc"] },
] as const;

export function partCategoryTitle(key: string) {
  return PART_CATEGORIES.find((c) => c.key === key)?.title ?? categoryLabel(key);
}

// Характеристики, по которым можно фильтровать каталог
export const SPEC_FILTERS: Record<string, { key: string; label: string }[]> = {
  cpu: [{ key: "socket", label: "Сокет" }, { key: "igpu", label: "Встроенная графика" }],
  mb: [{ key: "socket", label: "Сокет" }, { key: "ram_type", label: "Память" }, { key: "form_factor", label: "Форм-фактор" }],
  ram: [{ key: "ram_type", label: "Тип" }, { key: "capacity", label: "Объём" }],
  gpu: [{ key: "vram", label: "Видеопамять" }],
  ssd: [{ key: "capacity", label: "Объём" }],
  hdd: [{ key: "capacity", label: "Объём" }],
  psu: [{ key: "wattage", label: "Мощность, Вт" }, { key: "cert", label: "Сертификат" }],
  case: [{ key: "form_factor", label: "Платы" }],
  cooler: [{ key: "type", label: "Тип" }],
  fan: [{ key: "type", label: "Тип" }],
  laptop: [{ key: "type", label: "Тип" }],
  monitor: [{ key: "type", label: "Тип" }, { key: "size", label: "Диагональ" }, { key: "res", label: "Разрешение" }, { key: "hz", label: "Частота" }],
  periph: [{ key: "type", label: "Тип" }],
  chair: [{ key: "type", label: "Тип" }],
  office: [{ key: "type", label: "Тип" }],
  misc: [{ key: "type", label: "Тип" }],
};
