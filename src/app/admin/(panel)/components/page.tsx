import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { listComponents, markupOf, partPrice, partsMarkup, pricing } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { CATEGORIES, categoryLabel } from "@/lib/catalog";
import { formatNumber, formatSum } from "@/lib/format";
import { BulkTools } from "./BulkTools";
import { BulkMarkup, MarkupCell } from "./Markup";
import { PartIcon } from "@/components/PartIcon";

export default async function ComponentsAdmin({ searchParams }: PageProps<"/admin/components">) {
  await requireAdmin();
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const brand = typeof sp.brand === "string" ? sp.brand : "";
  const s = getSettings();
  const comps = listComponents({ category: cat || undefined, q: q || undefined, brand: brand || undefined });
  const brands = (
    db().prepare(`SELECT DISTINCT brand FROM components WHERE brand IS NOT NULL AND brand != '' ${cat ? "AND category = ?" : ""} ORDER BY brand`).all(...(cat ? [cat] : [])) as { brand: string }[]
  ).map((r) => r.brand);
  const pm = partsMarkup(s);
  const bm = pricing(s).markup;
  const filterLabel = [cat ? categoryLabel(cat) : "", brand, q ? `«${q}»` : ""].filter(Boolean).join(" · ") || "всех товаров";
  const imgStats = db().prepare("SELECT SUM(image IS NULL) AS without, SUM(image IS NULL AND image_checked = 0) AS unchecked, COUNT(*) AS total FROM components").get() as { without: number; unchecked: number; total: number };
  const usage = new Map(
    (db().prepare("SELECT component_id, COUNT(*) AS c FROM build_items GROUP BY component_id").all() as { component_id: number; c: number }[]).map(
      (r) => [r.component_id, r.c],
    ),
  );
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">Комплектующие</h1>
        <Link href="/admin/components/new" className="btn-accent">+ Добавить</Link>
      </div>
      <p className="mt-1 text-sm text-muted">
        Каждая комплектующая привязана к коду позиции в прайсе AGE — цена и наличие подтягиваются автоматически.
      </p>

      <BulkTools withoutImage={imgStats.without ?? 0} unchecked={imgStats.unchecked ?? 0} />

      <form className="mt-6 flex flex-wrap gap-2">
        <select name="cat" defaultValue={cat} className="input w-52">
          <option value="">Все категории</option>
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </select>
        <select name="brand" defaultValue={brand} className="input w-44">
          <option value="">Все бренды</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <input name="q" defaultValue={q} placeholder="Поиск по названию или коду" className="input w-64" />
        <span className="self-center text-sm text-muted">Всего {imgStats.total}, без фото {imgStats.without ?? 0}</span>
        <button className="btn-ghost">Найти</button>
      </form>

      <BulkMarkup cat={cat} brand={brand} q={q} count={comps.length} label={filterLabel} />
      <p className="mt-2 text-xs text-muted">
        Пустая наценка — общая из настроек: {pm}% при продаже по отдельности, {bm}% в сборках. Своя наценка товара действует везде: отдельно, в сборках и в конфигураторе.
      </p>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-sm xl:min-w-[720px]">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Товар</th>
              <th className="hidden px-3 py-3 text-right whitespace-nowrap sm:table-cell">Прайс / себест.</th>
              <th className="px-3 py-3 text-right">Наценка</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">На сайте</th>
              <th className="hidden px-3 py-3 lg:table-cell">Наличие</th>
              <th className="hidden px-3 py-3 text-right xl:table-cell" title="В скольких сборках используется">Сборки</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {comps.map((c) => (
              <tr key={c.id} className={`hover:bg-surface-2/50 ${c.active ? "" : "opacity-50"}`}>
                <td className="max-w-0 px-3 py-2 sm:w-[46%]">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-11 shrink-0 items-center justify-center overflow-hidden rounded p-0.5 ${c.image ? "bg-white" : "bg-surface-2"}`}>
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                      ) : <PartIcon category={c.category} className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <Link href={`/admin/components/${c.id}`} className="block truncate hover:text-accent" title={c.name}>{c.name}</Link>
                      <div className="truncate text-xs text-muted">
                        {categoryLabel(c.category)}
                        {c.brand ? ` · ${c.brand}` : ""}
                        {c.price_code ? <span className="font-mono"> · {c.price_code}</span> : null}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-2 text-right whitespace-nowrap sm:table-cell">
                  <div>
                    {c.price_source === "pricelist" ? `${formatNumber(c.supplier_price)} ${s.price_currency === "USD" ? "$" : ""}` : c.price_source === "manual" ? <span className="text-xs text-muted">ручная</span> : <span className="text-danger">нет</span>}
                  </div>
                  <div className="text-xs text-muted">{formatSum(c.cost)}</div>
                </td>
                <td className="px-3 py-2">
                  <MarkupCell key={`${c.id}-${c.markup_percent ?? ""}`} id={c.id} value={c.markup_percent} fallback={pm} />
                </td>
                <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">{formatSum(partPrice(c.cost, markupOf(c, pm)))}</td>
                <td className="hidden px-3 py-2 lg:table-cell">
                  {c.cost == null ? (
                    <span className="badge bg-danger/10 text-danger">нет цены</span>
                  ) : c.in_stock ? (
                    <span className="badge bg-ok/10 text-ok">есть</span>
                  ) : (
                    <span className="badge bg-warn/10 text-warn">нет</span>
                  )}
                </td>
                <td className="hidden px-3 py-2 text-right text-muted xl:table-cell">{usage.get(c.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!comps.length ? <p className="p-6 text-center text-sm text-muted">Ничего не найдено</p> : null}
      </div>
    </div>
  );
}
