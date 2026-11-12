"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { getCartItems, type CartItemInfo } from "../actions";
import { partHref } from "@/lib/format";
import { useI18n } from "@/lib/i18n/client";
import { ProductImage } from "@/components/ProductImage";
import { MoneyText } from "@/components/MoneyText";
import { OrderForm } from "@/components/OrderForm";

export function CartView() {
  const cart = useCart();
  const { t } = useI18n();
  const [info, setInfo] = useState<Record<number, CartItemInfo> | null>(null);
  const idsKey = cart.lines.map((l) => l.id).join(",");

  useEffect(() => {
    let alive = true;
    const ids = idsKey ? idsKey.split(",").map(Number) : [];
    getCartItems(ids).then((items) => {
      if (alive) setInfo(Object.fromEntries(items.map((i) => [i.id, i])));
    });
    return () => {
      alive = false;
    };
  }, [idsKey]);

  if (!cart.lines.length)
    return (
      <div className="card mt-6 p-10 text-center">
        <p className="text-muted">{t.cart.empty}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/parts" className="btn-accent">{t.nav.parts}</Link>
          <Link href="/catalog" className="btn-ghost">{t.nav.builds}</Link>
        </div>
      </div>
    );

  const rows = cart.lines.map((l) => ({ ...l, item: info?.[l.id] }));
  const missing = info ? rows.filter((r) => !r.item) : [];
  const total = rows.reduce((a, r) => a + (r.item ? r.item.price * r.qty : 0), 0);
  const valid = rows.filter((r) => r.item);

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="card divide-y divide-line">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-4 p-4">
            <ProductImage src={r.item?.image} category={r.item?.category ?? "case"} className="h-16 w-16 rounded-lg" pad="p-1" iconClass="h-9 w-9" eager sizes="64px" />
            <div className="min-w-0 flex-1">
              {r.item ? (
                <Link href={partHref(r.item.id, r.item.name)} className="line-clamp-2 text-sm font-medium hover:underline">{r.item.name}</Link>
              ) : (
                <span className="text-sm text-muted">{info ? t.cart.unavailable : t.cart.loading}</span>
              )}
              {r.item ? <div className="mt-1 text-xs text-muted">{t.cart.perPiece(t.money(r.item.price))}</div> : null}
            </div>
            <div className="flex items-center rounded-xl border border-line-2">
              <button type="button" className="px-3 py-1.5 text-muted hover:text-text" onClick={() => cart.setQty(r.id, r.qty - 1)} aria-label={t.cart.less}>−</button>
              <span className="w-6 text-center text-sm">{r.qty}</span>
              <button type="button" className="px-3 py-1.5 text-muted hover:text-text" onClick={() => cart.setQty(r.id, r.qty + 1)} aria-label={t.cart.more}>+</button>
            </div>
            <div className="hidden w-32 text-right text-sm font-semibold whitespace-nowrap sm:block">{r.item ? t.money(r.item.price * r.qty) : "—"}</div>
            <button type="button" onClick={() => cart.remove(r.id)} className="text-muted hover:text-danger" aria-label={t.cart.remove}>×</button>
          </div>
        ))}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="card p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">{t.cart.total(valid.reduce((a, r) => a + r.qty, 0))}</span>
            <span className="font-display text-2xl font-bold">{info ? <MoneyText text={t.money(total)} /> : "…"}</span>
          </div>
          {missing.length ? (
            <p className="mt-3 text-xs text-warn">{t.cart.missing}</p>
          ) : null}
          <div className="mt-6 border-t border-line pt-6">
            <OrderForm
              hidden={{ source: "cart", cart: JSON.stringify(valid.map((r) => ({ id: r.id, qty: r.qty }))) }}
              disabled={!valid.length}
              submitLabel={t.order.submit}
            />
          </div>
        </div>
        <Link href="/parts" className="mt-4 block text-center text-sm text-muted hover:text-text">{t.cart.continue}</Link>
      </aside>
    </div>
  );
}
