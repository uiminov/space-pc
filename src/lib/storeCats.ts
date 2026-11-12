// Разделы магазина помимо комплектующих ПК: техника, периферия, мебель, мелочи.
// Категория и тип товара определяются по названию позиции прайса AGE
// (в листе Export нет разделов, поэтому опираемся на слова в названии).

export const STORE_CATEGORIES = [
  { key: "laptop", label: "Ноутбуки и моноблоки", short: "Ноутбуки" },
  { key: "monitor", label: "Мониторы", short: "Мониторы" },
  { key: "periph", label: "Аксессуары", short: "Аксессуары" },
  { key: "chair", label: "Кресла и столы", short: "Кресла" },
  { key: "office", label: "Принтеры и оргтехника", short: "Оргтехника" },
  { key: "misc", label: "Мелочи", short: "Мелочи" },
] as const;

export type StoreCategoryKey = (typeof STORE_CATEGORIES)[number]["key"];
export const STORE_KEYS: string[] = STORE_CATEGORIES.map((c) => c.key);

export type StoreGuess = { category: StoreCategoryKey; specs: Record<string, string> };

// «Модель (CPU/ DDR5 16GB/ SSD 512GB/ …)» — так в прайсе записаны готовые компьютеры
const PC_SPEC = /\(.*\/.*(ddr\d|ssd|\d+\s*gb|hdd).*\)|\(mb [a-z]?\d+/i;

export function guessStore(raw: string): StoreGuess | null {
  const t = raw.toLowerCase();
  const as = (category: StoreCategoryKey, type: string, extra: Record<string, string> = {}): StoreGuess => ({ category, specs: { type, ...extra } });

  // Мониторы: «Бренд - 27" … Monitor, IPS, 240Hz, QHD (2560x1440)»
  if (/monitor|монитор/.test(t) || /^[a-z ]+ - \d{2}(\.\d)?["”]/.test(t)) {
    if (!PC_SPEC.test(t) || /monitor|монитор/.test(t)) {
      const size = t.match(/(\d{2}(?:[.,]\d)?)\s*["”]/)?.[1]?.replace(",", ".");
      const hz = t.match(/(\d{2,3})\s*hz/)?.[1];
      const res = /5k|5120/.test(t) ? "5K" : /uhd|4k|3840/.test(t) ? "4K" : /3440|uwqhd|wqhd \(3440/.test(t) ? "UWQHD" : /qhd|2560\s*[x×х*]\s*1440|2560x1600|wqxga/.test(t) ? "QHD" : /2560\s*[x×х*]\s*1080|uwhd/.test(t) ? "UWFHD" : "FHD";
      const extra: Record<string, string> = { res };
      if (size) extra.size = `${Math.round(Number(size))}"`;
      if (hz) extra.hz = `${hz} Гц`;
      return as("monitor", /gaming|игров|esports|odyssey|ultragear|legion|\brog\b|\btuf\b|aorus/.test(t) ? "Игровой" : "Офисный", extra);
    }
  }

  // Сначала то, что легко спутать с техникой по слову в названии
  // Экраны для проекторов: «… Диагональ: 100"/ Размер: 228х161см …»
  if (/диагональ:.*размер/.test(t)) return as("office", "Экран для проектора");
  // Память для ноутбуков (SODIMM) — в конфигуратор настольных ПК не идёт
  if (/so-?dimm?/.test(t)) return as("misc", "Память для ноутбука");
  // Расходники к принтерам
  if (/чернила|печатающая головка|printhead|ink bottle/.test(t)) return as("office", "Картриджи и чернила");
  if (/коврик|mouse ?pad|mousepad/.test(t)) return as("misc", "Коврик");
  if (/сумк|рюкзак|чехол|sleeve|backpack|bckpck|\bbag\b|top ?load/.test(t) && !PC_SPEC.test(t)) return as("misc", "Сумка и чехол");
  // сканеры («…планшет…» в описании) и подставки под ноутбук — раньше проверки на ноутбуки
  if (/сканер|scanner|czur/.test(t)) return as("office", "Сканер");
  if (/подставк|laptop stand/.test(t)) return as("misc", "Подставка и кронштейн");
  if (/док-?станц|docking|\bdock\b|usb.?hub|\bhub\b|хаб/.test(t)) return as("misc", "Док-станция и хаб");
  if (/стилус|stylus|\bpen\b/.test(t)) return as("misc", "Стилус");
  if (/адаптер|adapter|переходник|кабель|\bcable\b|utility cord|удлинит|сетевой фильтр|^spg\d|зарядн|charger|power bank/.test(t) && !PC_SPEC.test(t)) return as("misc", "Кабель и адаптер");

  // Готовые компьютеры: ноутбуки, моноблоки, настольные
  if (PC_SPEC.test(t) || /ноутбук|notebook|laptop|macbook|моноблок|\baio\b|all[- ]in[- ]one|mac mini|планшет|\btab\b/.test(t)) {
    if (/планшет|\btab\b|ipad/.test(t)) return as("laptop", "Планшет");
    if (/моноблок|\baio\b|all[- ]in[- ]one|omnistudio|eliteone|prostudio|ideacentre aio|imac/.test(t)) return as("laptop", "Моноблок");
    if (/desktop|omnidesk|expertcenter|thinkcentre|mini ?pc|mac mini|\bnuc\b|eliteboard|\bsff\b|tower|elitedesk|prodesk|vostro \d+ ?mt/.test(t)) return as("laptop", "Компьютер");
    return as("laptop", "Ноутбук");
  }

  // Оргтехника
  if (/принтер|мфу|printer|laserjet|i-sensys|imagerunner|maxify|pixma|ecotank|стр\/мин|стр \/ мин|pantum|^epson l\d|^xerox/.test(t)) return as("office", "Принтер и МФУ");
  if (/сканер|scanner|czur/.test(t)) return as("office", "Сканер");
  if (/картридж|тонер|toner|cartridge|\bdrum\b/.test(t)) return as("office", "Картриджи и чернила");
  if (/\bups\b|ибп|бесперебой|\d+\s?va\b|^bat-\d+v/.test(t)) return as("office", "ИБП");
  if (/проектор|projector/.test(t)) return as("office", "Проектор");

  // Мебель
  // (\b в JS не работает с кириллицей, поэтому границу слова проверяем явно)
  if (/кресло|chair|стул(?![а-яё])|gaming seat|sgs20|[uv][- ]comfort|u-fit|^uft /.test(t)) return as("chair", "Кресло");
  if (/стол(?![а-яё])|gaming desk/.test(t)) return as("chair", "Стол");

  // Периферия
  if (/клавиатура\s*\+\s*мыш|keyboard and mouse|keyboard \+ mouse|мышь\s*\+\s*клавиатур|\bcombo\b|набор|комплект/.test(t)) return as("periph", "Комплект");
  if (/мыш|mouse|pulsefire|\bmse\b/.test(t)) return as("periph", "Мышь");
  if (/клавиатур|keyboard|g?kbd\b/.test(t)) return as("periph", "Клавиатура");
  // наушники Audio-Technica (ATH-…) и Koss (KPH, KSC, UR, BT…i, CS…) записаны в прайсе только артикулом
  if (/наушник|headset|гарнитур|earbuds|headphone|porta pro|hyperx cloud|\btws\b|gam hs|^(ath-|kph\d|ksc\d|ktxpro|ur\d|bt\d{3}i|pro4s|sb40|cs\d{3}|gmr\d|td85|plug wireless)/.test(t)) return as("periph", "Наушники");
  if (/микрофон|microphone|quadcast|solocast/.test(t)) return as("periph", "Микрофон");
  if (/акустич|колонк|speaker|soundbar|саундбар/.test(t)) return as("periph", "Колонки");
  if (/webcam|веб-?камер|web-?cam/.test(t)) return as("periph", "Веб-камера");
  if (/джойстик|геймпад|gamepad|controller|пульт|руль/.test(t)) return as("periph", "Геймпад");

  // Прочие мелочи
  if (/ext hdd|ext ssd|ext dvd|внешн|portable (ssd|hdd)/.test(t)) return as("misc", "Внешний диск и привод");
  if (/флеш|флэш|flash|usb drive|microsd|sd card|карта памяти/.test(t)) return as("misc", "Флешка и карта памяти");
  if (/подставк|кронштейн|\bstand\b|\bmount\b|\barm\b/.test(t)) return as("misc", "Подставка и кронштейн");
  return null;
}
