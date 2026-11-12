"use client";

import { useSyncExternalStore } from "react";

// Корзина хранится в браузере покупателя. Цены здесь не храним — их всегда даёт сервер.
export type CartLine = { id: number; qty: number };

const KEY = "pcstore_cart_v1";
const listeners = new Set<() => void>();
let cache: CartLine[] | null = null;
const EMPTY: CartLine[] = [];

function read(): CartLine[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as CartLine[];
    cache = Array.isArray(raw) ? raw.filter((l) => l && Number(l.id) > 0).map((l) => ({ id: Number(l.id), qty: Math.max(1, Number(l.qty) || 1) })) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    lines,
    count: lines.reduce((a, l) => a + l.qty, 0),
    add(id: number, qty = 1) {
      const cur = read();
      const ex = cur.find((l) => l.id === id);
      write(ex ? cur.map((l) => (l.id === id ? { ...l, qty: Math.min(20, l.qty + qty) } : l)) : [...cur, { id, qty }]);
    },
    setQty(id: number, qty: number) {
      write(read().map((l) => (l.id === id ? { ...l, qty: Math.max(1, Math.min(20, qty)) } : l)));
    },
    remove(id: number) {
      write(read().filter((l) => l.id !== id));
    },
    clear() {
      write([]);
    },
    has(id: number) {
      return lines.some((l) => l.id === id);
    },
  };
}
