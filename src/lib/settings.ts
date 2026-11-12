import "server-only";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  shop_name: "SPACE PC",
  phone: "+998 90 000 00 00",
  telegram: "spacepc",
  instagram: "spacepc.uz",
  address: "Ташкент, ул. Примерная, 1",
  work_hours: "Ежедневно 10:00–20:00",
  address_uz: "",
  work_hours_uz: "Har kuni 10:00–20:00",
  // Баннер-объявление на главной (раздел «Баннер» в админке)
  banner_on: "0",
  banner_title_uz: "",
  banner_title_ru: "",
  banner_text_uz: "",
  banner_text_ru: "",
  banner_btn_uz: "",
  banner_btn_ru: "",
  banner_link: "",
  banner_image: "",
  // Текст под заголовком первого экрана (пусто — стандартный)
  hero_sub_uz: "",
  hero_sub_ru: "",
  // Цены в прайсе AGE: USD или UZS
  price_currency: "USD",
  usd_rate: "12650",
  // Автоматически брать курс ЦБ Узбекистана (cbu.uz) — AGE принимает оплату по курсу ЦБ
  usd_rate_auto: "1",
  usd_rate_date: "",
  usd_rate_checked_at: "",
  // Наценка магазина на комплектующие, %
  markup_percent: "12",
  // Наценка при продаже комплектующих по отдельности, % (пусто — как у сборок)
  parts_markup_percent: "",
  // Стоимость сборки, тестирования и установки ОС, сум
  assembly_fee: "300000",
  // Округление итоговой цены вверх до, сум
  round_to: "10000",
  installment_months: "12",
  installment_markup_percent: "0",
  tg_bot_token: "",
  tg_chat_id: "",
  // Сопоставление колонок прайса (автоопределение, если пусто)
  import_col_code: "",
  import_col_name: "",
  import_col_price: "",
  import_col_stock: "",
  import_col_category: "",
  // Что делать с позициями, которых нет в новом прайсе
  import_missing_mode: "out_of_stock",
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export function getSettings(): Settings {
  const rows = db().prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    if (r.key in s) (s as Record<string, string>)[r.key] = r.value;
  }
  return s;
}

export function setSettings(values: Partial<Settings>) {
  const stmt = db().prepare(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  for (const [k, v] of Object.entries(values)) {
    if (k in DEFAULT_SETTINGS && v != null) stmt.run(k, String(v));
  }
}

export function num(v: string, fallback = 0) {
  const n = parseFloat(String(v).replace(",", ".").replace(/\s/g, ""));
  return isFinite(n) ? n : fallback;
}

// Курс ЦБ Республики Узбекистан
export async function fetchCbuRate(): Promise<{ rate: number; date: string }> {
  const r = await fetch("https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/", { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!r.ok) throw new Error(`ЦБ ответил ${r.status}`);
  const j = (await r.json()) as { Rate: string; Date: string }[];
  const rate = parseFloat(j?.[0]?.Rate);
  if (!isFinite(rate) || rate < 1000) throw new Error("Некорректный ответ ЦБ");
  return { rate, date: j[0].Date };
}

export async function refreshCbuRate() {
  const { rate, date } = await fetchCbuRate();
  setSettings({ usd_rate: String(rate), usd_rate_date: date, usd_rate_checked_at: new Date().toISOString() });
  return { rate, date };
}

// Вызывается при показе страниц: обновляет курс не чаще раза в 3 часа, ошибки не мешают работе сайта
export async function ensureFreshRate() {
  const s = getSettings();
  if (s.usd_rate_auto !== "1" || s.price_currency !== "USD") return;
  const last = Date.parse(s.usd_rate_checked_at || "") || 0;
  if (Date.now() - last < 3 * 60 * 60 * 1000) return;
  setSettings({ usd_rate_checked_at: new Date().toISOString() }); // не долбить ЦБ при ошибках
  try {
    await refreshCbuRate();
  } catch (e) {
    console.error("CBU rate update failed:", (e as Error).message);
  }
}
