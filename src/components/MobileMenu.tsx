"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { MenuSection } from "./CatalogMenu";
import { PartIcon } from "./PartIcon";

// Меню на телефоне и планшете: поиск, основные страницы и весь каталог по разделам
export function MobileMenu({
  items,
  sections,
  label,
  search,
  catalogLabel,
}: {
  items: { href: string; label: string }[];
  sections: MenuSection[];
  label: string;
  search: { placeholder: string; button: string };
  catalogLabel: string;
}) {
  const [open, setOpen] = useState(false);
  // раздел каталога, раскрытый в меню: по умолчанию «Ноутбуки и мониторы» — чтобы сразу было видно, что они есть
  const [openSec, setOpenSec] = useState<string | null>(sections[1]?.title ?? sections[0]?.title ?? null);
  // страницы, которые уже есть в разделах каталога, внизу не повторяем
  const inCatalog = new Set(sections.flatMap((s) => s.links.map((l) => l.href)));
  const rest = items.filter((n) => !inCatalog.has(n.href));
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);

  // закрываем при переходе на другую страницу и по клику вне меню
  const [prevPath, setPrevPath] = useState(path);
  if (prevPath !== path) {
    setPrevPath(path);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const link = (href: string) =>
    `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-surface-2 ${path === href ? "bg-surface-2 text-text" : "text-muted"}`;

  return (
    <div ref={box} className="relative xl:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-xl border border-line-2 text-muted hover:text-text"
        aria-label={label}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open ? (
        <nav className="card absolute top-11 right-0 z-50 max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-2 shadow-2xl shadow-black/40">
          <form action="/parts/all" role="search" className="relative mb-2">
            <input name="q" type="search" placeholder={search.placeholder} aria-label={search.placeholder} className="input py-2.5 pr-10" />
            <button type="submit" aria-label={search.button} className="absolute top-1/2 right-1.5 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </button>
          </form>

          <div className="label px-3 pt-1">{catalogLabel}</div>
          {sections.map((s) => {
            const on = openSec === s.title;
            return (
              <div key={s.title}>
                <button
                  type="button"
                  onClick={() => setOpenSec(on ? null : s.title)}
                  aria-expanded={on}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-surface-2"
                >
                  {s.title}
                  <svg viewBox="0 0 24 24" className={`h-4 w-4 text-muted transition-transform ${on ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {on ? (
                  <div className="pb-1 pl-2">
                    {s.links.map((l) => (
                      <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={link(l.href)}>
                        {l.icon ? <PartIcon category={l.icon} className="h-5 w-5 shrink-0" glow={false} /> : null}
                        <span className="min-w-0 flex-1 truncate">{l.label}</span>
                        {l.count ? <span className="text-xs text-muted/70 tabular-nums">{l.count}</span> : null}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="my-2 border-t border-line" />
          {rest.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={link(n.href)}>
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
