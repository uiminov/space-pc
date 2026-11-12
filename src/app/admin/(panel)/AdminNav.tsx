"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/orders", label: "Заказы" },
  { href: "/admin/builds", label: "Сборки" },
  { href: "/admin/components", label: "Комплектующие" },
  { href: "/admin/prices", label: "Прайс AGE" },
  { href: "/admin/prices/darian", label: "Прайс Darian" },
  { href: "/admin/compare", label: "Сравнение цен" },
  { href: "/admin/banner", label: "Баннер и главная" },
  { href: "/admin/settings", label: "Настройки" },
];

export function AdminNav({ newOrders }: { newOrders: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
      {ITEMS.map((i) => {
        // активен самый длинный подходящий пункт («/admin/prices/darian», а не «/admin/prices»)
        const match = (h: string) => (h === "/admin" ? path === "/admin" : path === h || path.startsWith(h + "/"));
        const active = match(i.href) && !ITEMS.some((x) => x.href.length > i.href.length && match(x.href));
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${
              active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2 hover:text-text"
            }`}
          >
            {i.label}
            {i.href === "/admin/orders" && newOrders > 0 ? (
              <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-accent-ink">{newOrders}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
