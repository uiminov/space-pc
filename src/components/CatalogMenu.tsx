import Link from "next/link";
import type { Dict } from "@/lib/i18n/dict";
import { PartIcon } from "./PartIcon";

export type MenuSection = { title: string; links: { href: string; label: string; count?: number; icon?: string }[] };

// Разделы каталога, сгруппированные для меню (шапка на компьютере и меню на телефоне)
export function catalogSections(t: Dict, counts: Record<string, number>, groups: { laptops: readonly string[]; parts: readonly string[]; more: readonly string[] }): MenuSection[] {
  const cat = (key: string) => ({ href: `/parts/${key}`, label: t.catPlural[key] ?? key, count: counts[key], icon: key });
  const has = (key: string) => (counts[key] ?? 0) > 0;
  return [
    {
      title: t.menu.pcs,
      links: [
        { href: "/catalog", label: t.menu.ready, icon: "case" },
        { href: "/configurator", label: t.menu.build, icon: "mb" },
      ],
    },
    { title: t.menu.laptops, links: groups.laptops.filter(has).map(cat) },
    { title: t.menu.parts, links: groups.parts.filter(has).map(cat) },
    { title: t.menu.more, links: groups.more.filter(has).map(cat) },
  ];
}

// «Каталог» в шапке: при наведении (или фокусе с клавиатуры) раскрывается панель со всеми разделами.
// Чистый CSS — работает без JavaScript; клик по самой кнопке ведёт на страницу каталога.
export function CatalogMenu({ label, sections, allLabel }: { label: string; sections: MenuSection[]; allLabel: string }) {
  return (
    <div className="group relative">
      <Link href="/parts" className="flex items-center gap-1 rounded-lg px-3 py-2 whitespace-nowrap text-text hover:text-text" aria-haspopup="true">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        {label}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-muted transition-transform group-hover:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Link>
      {/* мостик, чтобы панель не закрывалась, пока мышь идёт от кнопки к панели */}
      <div className="invisible absolute top-full left-0 z-50 pt-2 opacity-0 transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div className="card grid w-[min(1000px,calc(100vw-3rem))] grid-cols-4 gap-5 p-5 shadow-2xl shadow-black/40">
          {sections.map((s) => (
            <div key={s.title} className="min-w-0">
              <div className="label">{s.title}</div>
              <ul className="space-y-0.5">
                {s.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="group/l flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
                      {l.icon ? <PartIcon category={l.icon} className="h-5 w-5 shrink-0" glow={false} /> : null}
                      <span className="min-w-0 flex-1 leading-snug">{l.label}</span>
                      {l.count ? <span className="text-xs text-muted/70 tabular-nums">{l.count}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="col-span-4 border-t border-line pt-3">
            <Link href="/parts" className="text-sm font-semibold hover:text-accent">
              {allLabel} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// Поиск по всему каталогу (ведёт на /parts/all?q=…)
export function SearchBox({ placeholder, button, className = "" }: { placeholder: string; button: string; className?: string }) {
  return (
    <form action="/parts/all" role="search" className={`relative ${className}`}>
      <input name="q" type="search" placeholder={placeholder} aria-label={placeholder} className="input py-2 pr-10 pl-3" />
      <button type="submit" aria-label={button} className="absolute top-1/2 right-1.5 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-text">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </button>
    </form>
  );
}
