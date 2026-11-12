import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listParts } from "@/lib/repo";
import { PART_CATEGORIES, SPEC_FILTERS } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";
import { locSpec } from "@/lib/i18n/dict";
import { PartCard } from "@/components/PartCard";

const PAGE = 30;

export async function generateMetadata({ params }: PageProps<"/parts/[category]">): Promise<Metadata> {
  const { category } = await params;
  const { t } = await getT();
  return { title: category === "all" ? t.meta.partsSearch : t.meta.partsCat(t.catPlural[category] ?? category) };
}

// Сортировка значений характеристик «по-человечески»: 8 ГБ < 16 ГБ < 1 ТБ
function valueRank(v: string) {
  const n = parseFloat(v.replace(",", "."));
  if (isNaN(n)) return Infinity;
  return /тб/i.test(v) ? n * 1000 : n;
}

export default async function PartsCategory({ params, searchParams }: PageProps<"/parts/[category]">) {
  const { category } = await params;
  const isAll = category === "all";
  if (!isAll && !PART_CATEGORIES.some((c) => c.key === category)) notFound();
  const sp = await searchParams;
  const { lang, t } = await getT();
  const catTitle = t.catPlural[category] ?? category;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  const filterDefs = isAll ? [] : SPEC_FILTERS[category] ?? [];
  const specs: Record<string, string> = {};
  for (const f of filterDefs) if (one(`f_${f.key}`)) specs[f.key] = one(`f_${f.key}`);
  const q = one("q");
  const brand = one("brand");
  const sort = one("sort");
  const min = parseInt(one("min")) || 0;
  const max = parseInt(one("max")) || 0;
  const page = Math.max(1, parseInt(one("page")) || 1);

  const { items, base } = listParts({ category: isAll ? undefined : category, q, brand, min, max, sort, specs });
  const brands = [...new Set(base.map((p) => p.brand).filter(Boolean) as string[])].sort();
  const options = (key: string) =>
    [...new Set(base.map((p) => p.specs[key]).filter(Boolean))].sort((a, b) => valueRank(a) - valueRank(b) || a.localeCompare(b));
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const shown = items.slice((page - 1) * PAGE, page * PAGE);

  const link = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { q, brand, sort, min: min ? String(min) : "", max: max ? String(max) : "", page: String(page) };
    for (const [k, v] of Object.entries(specs)) cur[`f_${k}`] = v;
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v && !(k === "page" && v === "1")) p.set(k, v);
    const s = p.toString();
    return `/parts/${category}${s ? `?${s}` : ""}`;
  };

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-muted">
        <Link href="/parts" className="hover:text-text">{t.parts.title}</Link> <span className="mx-1">/</span>{" "}
        {isAll ? t.parts.search : catTitle}
      </nav>
      <h1 className="font-display mt-3 text-3xl font-bold">{isAll ? (q ? t.parts.searchFor(q) : t.parts.allParts) : catTitle}</h1>

      {!isAll ? (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {PART_CATEGORIES.map((c) => (
            <Link key={c.key} href={`/parts/${c.key}`} className={`chip shrink-0 ${c.key === category ? "chip-on" : ""}`}>
              {t.catPlural[c.key]}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-5 space-y-5">
        <div>
        <input type="checkbox" id="part-filters" className="peer sr-only" />
        <label htmlFor="part-filters" className="btn-ghost w-full cursor-pointer lg:hidden">⚙ {t.parts.filters}</label>
        <form action={`/parts/${category}`} className="card mt-3 hidden grid-cols-2 items-end gap-3 p-4 peer-checked:grid sm:grid-cols-3 lg:mt-0 lg:flex lg:flex-wrap [&_.input]:py-2">
          <div className="col-span-2 sm:col-span-3 lg:min-w-[200px] lg:flex-[2]">
            <label className="label" htmlFor="q">{t.parts.search}</label>
            <input id="q" name="q" defaultValue={q} className="input" placeholder={t.parts.namePh} />
          </div>
          {brands.length > 1 ? (
            <div className="lg:min-w-[130px] lg:flex-1">
              <label className="label" htmlFor="brand">{t.parts.brand}</label>
              <select id="brand" name="brand" defaultValue={brand} className="input">
                <option value="">{t.parts.all}</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          ) : null}
          {filterDefs.map((f) => {
            const opts = options(f.key);
            if (opts.length < 2) return null;
            return (
              <div key={f.key} className="lg:min-w-[120px] lg:flex-1">
                <label className="label" htmlFor={`f_${f.key}`}>{t.spec[f.key === "form_factor" && category === "case" ? "boards" : f.key] ?? f.label}</label>
                <select id={`f_${f.key}`} name={`f_${f.key}`} defaultValue={specs[f.key] ?? ""} className="input">
                  <option value="">{t.parts.anyM}</option>
                  {opts.map((o) => (
                    <option key={o} value={o}>{locSpec(o, lang)}</option>
                  ))}
                </select>
              </div>
            );
          })}
          <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-1 lg:w-[210px]">
            <div>
              <label className="label" htmlFor="min">{t.parts.priceFrom}</label>
              <input id="min" name="min" inputMode="numeric" defaultValue={min || ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="max">{t.parts.to}</label>
              <input id="max" name="max" inputMode="numeric" defaultValue={max || ""} className="input" />
            </div>
          </div>
          <div className="lg:min-w-[150px] lg:flex-1">
            <label className="label" htmlFor="sort">{t.catalog.sort}</label>
            <select id="sort" name="sort" defaultValue={sort} className="input">
              <option value="">{t.catalog.sortAsc}</option>
              <option value="price_desc">{t.catalog.sortDesc}</option>
              <option value="name">{t.parts.sortName}</option>
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3 sm:col-span-3 lg:col-auto">
            <button className="btn-accent flex-1 py-2 lg:flex-none lg:px-6">{t.parts.show}</button>
            <Link href={`/parts/${category}`} className="text-xs whitespace-nowrap text-muted hover:text-text">{t.catalog.reset}</Link>
          </div>
        </form>
        </div>

        <div>
          <p className="text-sm text-muted">{t.parts.found(items.length)}</p>
          {shown.length ? (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((p) => (
                <PartCard key={p.id} p={{ id: p.id, name: p.name, category: p.category, image: p.image, price: p.price, inStock: p.in_stock, specs: p.specs }} lang={lang} />
              ))}
            </div>
          ) : (
            <div className="card mt-3 p-10 text-center text-muted">
              {t.parts.nothing} <Link href={`/parts/${category}`} className="text-text underline">{t.catalog.reset}</Link>
            </div>
          )}
          {pages > 1 ? (
            <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
              {page > 1 ? <Link href={link({ page: String(page - 1) })} className="chip">{t.parts.prev}</Link> : null}
              {Array.from({ length: pages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 2)
                .map((n, i, arr) => (
                  <span key={n} className="flex items-center gap-2">
                    {i > 0 && n - arr[i - 1] > 1 ? <span className="text-muted">…</span> : null}
                    <Link href={link({ page: String(n) })} className={`chip ${n === page ? "chip-on" : ""}`}>{n}</Link>
                  </span>
                ))}
              {page < pages ? <Link href={link({ page: String(page + 1) })} className="chip">{t.parts.next}</Link> : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
