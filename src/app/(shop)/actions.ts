"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getBuildBySlug, getComponent, getPart, pricing, roundUp } from "@/lib/repo";
import { notifyTelegram, esc } from "@/lib/telegram";
import { formatSum } from "@/lib/format";
import { categoryLabel } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";

export type OrderState = { error?: string } | undefined;

export async function createOrder(_prev: OrderState, fd: FormData): Promise<OrderState> {
  const name = String(fd.get("name") ?? "").trim().slice(0, 100);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 40);
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000);
  const source = String(fd.get("source") ?? "");
  const { lang, t } = await getT();
  if (!name) return { error: t.order.errName };
  if (phone.replace(/\D/g, "").length < 9) return { error: t.order.errPhone };

  let title = "";
  let total = 0;
  let items: { category: string; name: string; qty: number; code: string | null }[] = [];

  if (source === "build") {
    const b = getBuildBySlug(String(fd.get("slug") ?? ""));
    if (!b || !b.active) return { error: t.order.errBuild };
    title = `Сборка «${b.name}»`;
    total = b.price ?? 0;
    items = b.items.map((i) => ({ category: i.category, name: i.name, qty: i.qty, code: i.price_code }));
  } else if (source === "configurator") {
    let ids: number[] = [];
    try {
      ids = (JSON.parse(String(fd.get("ids") ?? "[]")) as unknown[]).map(Number).filter(Boolean).slice(0, 30);
    } catch {}
    const comps = ids.map((id) => getComponent(id)).filter((c) => c && c.active);
    if (!comps.length) return { error: t.order.errPick };
    const pr = pricing();
    let sum = 0;
    let priced = true;
    for (const c of comps) {
      if (c!.cost == null) priced = false;
      else sum += c!.cost * (1 + (c!.markup_percent ?? pr.markup) / 100);
    }
    total = priced ? roundUp(sum + pr.assembly, pr.roundTo) : 0;
    title = "Своя сборка из конструктора ПК";
    items = comps.map((c) => ({ category: c!.category, name: c!.name, qty: 1, code: c!.price_code }));
  } else if (source === "cart") {
    let lines: { id: number; qty: number }[] = [];
    try {
      lines = (JSON.parse(String(fd.get("cart") ?? "[]")) as { id: unknown; qty: unknown }[])
        .map((l) => ({ id: Number(l.id), qty: Math.max(1, Math.min(20, Math.floor(Number(l.qty)) || 1)) }))
        .filter((l) => l.id)
        .slice(0, 50);
    } catch {}
    const parts = lines.map((l) => ({ p: getPart(l.id), qty: l.qty })).filter((x) => x.p);
    if (!parts.length) return { error: t.order.errCart };
    total = parts.reduce((a, x) => a + x.p!.price * x.qty, 0);
    title = `Комплектующие (${parts.reduce((a, x) => a + x.qty, 0)} шт.)`;
    items = parts.map((x) => ({ category: x.p!.category, name: x.p!.name, qty: x.qty, code: x.p!.price_code }));
  } else return { error: t.order.errBad };

  const r = db()
    .prepare("INSERT INTO orders(name, phone, comment, source, title, items, total) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(name, phone, comment || null, source, title, JSON.stringify(items), total);
  const id = Number(r.lastInsertRowid);

  await notifyTelegram(
    [
      `🖥 <b>Новый заказ №${id}</b>`,
      esc(title),
      `Сумма: <b>${esc(formatSum(total))}</b>`,
      "",
      `👤 ${esc(name)}`,
      `📞 ${esc(phone)}`,
      comment ? `💬 ${esc(comment)}` : "",
      `🌐 ${lang === "uz" ? "O'zbekcha" : "Русский"}`,
      "",
      ...items.map((i) => `• ${esc(categoryLabel(i.category))}: ${esc(i.name)}${i.qty > 1 ? ` ×${i.qty}` : ""}`),
    ]
      .filter((l) => l !== null)
      .join("\n"),
  );

  redirect(`/order/success?id=${id}${source === "cart" ? "&cart=1" : ""}`);
}

export type CartItemInfo = { id: number; name: string; category: string; image: string | null; price: number; inStock: boolean };

// Актуальные цены и наличие для товаров в корзине (корзина хранится в браузере покупателя)
export async function getCartItems(ids: number[]): Promise<CartItemInfo[]> {
  return ids
    .slice(0, 50)
    .map((id) => getPart(Number(id)))
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.name, category: p.category, image: p.image, price: p.price, inStock: p.in_stock }));
}

export type QuoteState = { error?: string } | undefined;

const SEGMENT_RU: Record<string, string> = {
  club: "Компьютерный клуб",
  it: "IT-компания",
  edu: "Учебный центр",
  studio: "Дизайн, 3D и видео",
  office: "Офис",
};

// Заявка компании на коммерческое предложение (B2B)
export async function createQuote(_prev: QuoteState, fd: FormData): Promise<QuoteState> {
  const company = String(fd.get("company") ?? "").trim().slice(0, 150);
  const inn = String(fd.get("inn") ?? "").replace(/\D/g, "").slice(0, 20);
  const name = String(fd.get("name") ?? "").trim().slice(0, 100);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 40);
  const segment = String(fd.get("segment") ?? "").slice(0, 20);
  const qty = Math.min(10000, Math.max(0, Math.floor(Number(fd.get("qty")) || 0)));
  const pkgSlug = String(fd.get("package") ?? "").slice(0, 60);
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 2000);
  const { lang, t } = await getT();
  if (!name) return { error: t.order.errName };
  if (phone.replace(/\D/g, "").length < 9) return { error: t.order.errPhone };
  if (inn && inn.length !== 9) return { error: t.b2b.errInn };

  const b = pkgSlug ? getBuildBySlug(pkgSlug) : null;
  const pkg = b && b.active ? b : null;
  const seg = SEGMENT_RU[segment] ?? "";
  const title = `Заявка бизнеса: ${company || name}${qty ? ` — ${qty} ПК` : ""}${seg ? ` (${seg})` : ""}`;
  const items = pkg ? pkg.items.map((i) => ({ category: i.category, name: i.name, qty: i.qty * qty, code: i.price_code })) : [];
  const total = pkg?.price ? pkg.price * qty : 0;

  const r = db()
    .prepare(
      "INSERT INTO orders(name, phone, comment, source, title, items, total, company, inn, segment, qty) VALUES (?, ?, ?, 'b2b', ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(name, phone, comment || null, title, JSON.stringify(items), total, company || null, inn || null, segment || null, qty || null);
  const id = Number(r.lastInsertRowid);

  await notifyTelegram(
    [
      `🏢 <b>Заявка на КП №${id}</b>`,
      company ? `<b>${esc(company)}</b>${inn ? ` · ИНН ${esc(inn)}` : ""}` : "",
      seg ? `Сфера: ${esc(seg)}` : "",
      qty ? `Количество: <b>${qty} ПК</b>` : "",
      pkg ? `Конфигурация: «${esc(pkg.name)}»` : "",
      "",
      `👤 ${esc(name)}`,
      `📞 ${esc(phone)}`,
      comment ? `💬 ${esc(comment)}` : "",
      `🌐 ${lang === "uz" ? "O'zbekcha" : "Русский"}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  redirect(`/order/success?id=${id}&b2b=1`);
}
