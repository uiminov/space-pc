import Link from "next/link";
import type { Metadata } from "next";
import { listBuilds } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { toCard } from "@/lib/view";
import { BuildCard } from "@/components/BuildCard";
import { PURPOSES } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.catalog };
}


export default async function Catalog({ searchParams }: PageProps<"/catalog">) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined)) ?? "";
  const purpose = one("purpose");
  const sort = one("sort");
  const gpu = one("gpu");
  const min = parseInt(one("min")) || 0;
  const max = parseInt(one("max")) || 0;
  const inStock = one("stock") === "1";

  const s = getSettings();
  const { lang, t } = await getT();
  const SORTS = [
    { key: "", label: t.catalog.sortPop },
    { key: "price_asc", label: t.catalog.sortAsc },
    { key: "price_desc", label: t.catalog.sortDesc },
  ];
  let builds = listBuilds({ activeOnly: true });
  if (purpose) builds = builds.filter((b) => b.purpose === purpose);
  if (gpu === "nvidia") builds = builds.filter((b) => /geforce|rtx|gtx/i.test(b.byCategory.gpu?.[0]?.name ?? ""));
  if (gpu === "amd") builds = builds.filter((b) => /radeon|rx\s?\d/i.test(b.byCategory.gpu?.[0]?.name ?? ""));
  if (min) builds = builds.filter((b) => (b.price ?? 0) >= min);
  if (max) builds = builds.filter((b) => b.price != null && b.price <= max);
  if (inStock) builds = builds.filter((b) => b.available);
  if (sort === "price_asc") builds.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  if (sort === "price_desc") builds.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur = { purpose, sort, gpu, min: min ? String(min) : "", max: max ? String(max) : "", stock: inStock ? "1" : "", ...patch };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    const q = p.toString();
    return `/catalog${q ? `?${q}` : ""}`;
  };

  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="font-display text-2xl font-bold sm:text-4xl">{t.catalog.title}</h1>
      <p className="mt-2 text-muted">{t.catalog.sub}</p>

      <div className="mt-5 flex flex-col gap-3 sm:mt-8 sm:gap-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Link href={href({ purpose: "" })} className={`chip shrink-0 ${!purpose ? "chip-on" : ""}`}>{t.catalog.all}</Link>
          {PURPOSES.map((p) => (
            <Link key={p.key} href={href({ purpose: p.key })} className={`chip shrink-0 ${purpose === p.key ? "chip-on" : ""}`}>
              {t.purpose[p.key]}
            </Link>
          ))}
        </div>
        <input type="checkbox" id="cat-filters" className="peer sr-only" />
        <label htmlFor="cat-filters" className="btn-ghost w-fit cursor-pointer sm:hidden">⚙ {t.parts.filters}</label>
        <form action="/catalog" className="hidden flex-wrap items-end gap-3 peer-checked:flex sm:flex">
          {purpose ? <input type="hidden" name="purpose" value={purpose} /> : null}
          <div>
            <label className="label" htmlFor="min">{t.catalog.priceFrom}</label>
            <input id="min" name="min" inputMode="numeric" defaultValue={min || ""} className="input w-36" placeholder="0" />
          </div>
          <div>
            <label className="label" htmlFor="max">{t.catalog.priceTo}</label>
            <input id="max" name="max" inputMode="numeric" defaultValue={max || ""} className="input w-36" placeholder="∞" />
          </div>
          <div>
            <label className="label" htmlFor="gpu">{t.catalog.gpu}</label>
            <select id="gpu" name="gpu" defaultValue={gpu} className="input w-36">
              <option value="">{t.catalog.any}</option>
              <option value="nvidia">NVIDIA</option>
              <option value="amd">AMD</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="sort">{t.catalog.sort}</label>
            <select id="sort" name="sort" defaultValue={sort} className="input w-48">
              {SORTS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm">
            <input type="checkbox" name="stock" value="1" defaultChecked={inStock} className="accent-[var(--accent)]" />
            {t.catalog.onlyStock}
          </label>
          <button className="btn-ghost">{t.catalog.apply}</button>
        </form>
      </div>

      {builds.length ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {builds.map((b) => (
            <BuildCard key={b.id} b={toCard(b, s, lang)} lang={lang} />
          ))}
        </div>
      ) : (
        <div className="card mt-8 p-10 text-center text-muted">
          {t.catalog.empty} <Link href="/catalog" className="text-text underline">{t.catalog.reset}</Link> {t.catalog.or}{" "}
          <Link href="/configurator" className="text-text underline">{t.catalog.buildOwn}</Link>.
        </div>
      )}
    </div>
  );
}
