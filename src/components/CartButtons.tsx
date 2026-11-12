"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n/client";

export function AddToCart({ id, size = "md" }: { id: number; size?: "sm" | "md" }) {
  const cart = useCart();
  const { t } = useI18n();
  const inCart = cart.has(id);
  if (inCart)
    return (
      <Link href="/cart" className={`btn-ghost border-text text-text ${size === "sm" ? "px-3 py-2" : "w-full py-3 text-base"}`}>
        {t.part.inCart}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={() => cart.add(id)}
      className={`btn-accent ${size === "sm" ? "px-3 py-2" : "w-full py-3 text-base"}`}
    >
      {t.part.addToCart}
    </button>
  );
}

export function CartLink() {
  const { count } = useCart();
  const { t } = useI18n();
  return (
    <Link href="/cart" className="relative grid h-9 w-9 place-items-center rounded-xl border border-line-2 text-sm hover:border-muted sm:h-auto sm:w-auto sm:px-3 sm:py-2" aria-label={t.nav.cart}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" />
        <circle cx="10" cy="20" r="1.3" />
        <circle cx="17" cy="20" r="1.3" />
      </svg>
      {count > 0 ? (
        <span className="absolute -top-1.5 -right-1.5 min-w-5 rounded-full bg-accent px-1 text-center text-xs font-bold leading-5 text-accent-ink">{count}</span>
      ) : null}
    </Link>
  );
}

// Очищает корзину после оформленного заказа
export function ClearCart() {
  const { clear, count } = useCart();
  useEffect(() => {
    if (count) clear();
  }, [count, clear]);
  return null;
}
