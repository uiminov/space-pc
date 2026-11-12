import Link from "next/link";
import type { Metadata } from "next";
import { listParts } from "@/lib/repo";
import { PART_GROUPS } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";
import { PartIcon } from "@/components/PartIcon";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.parts };
}

export default async function PartsHome({ searchParams }: PageProps<"/parts">) {
  const { q } = await searchParams;
  const { t } = await getT();
  const all = listParts({}).items;
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="font-display text-2xl font-bold sm:text-4xl">{t.parts.title}</h1>
      <p className="mt-2 text-muted">{t.parts.count(all.length)}</p>

      <form action="/parts/all" className="mt-6 flex max-w-xl gap-2">
        <input name="q" defaultValue={typeof q === "string" ? q : ""} placeholder={t.parts.searchPh} className="input" />
        <button className="btn-accent">{t.parts.find}</button>
      </form>

      {PART_GROUPS.map((g) => {
        const tiles = g.cats
          .map((key) => ({ key, items: all.filter((p) => p.category === key) }))
          .filter((x) => x.items.length);
        if (!tiles.length) return null;
        return (
          <section key={g.key} className="mt-8">
            <h2 className="font-display text-xl font-bold">{g.key === "pc" ? t.parts.groupPc : t.parts.groupTech}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tiles.map(({ key, items }) => (
                <Link key={key} href={`/parts/${key}`} className="card group overflow-hidden hover:border-line-2">
                  <div className="flex aspect-[4/3] items-center justify-center border-b border-line">
                    <PartIcon category={key} className="h-14 w-14 transition-transform duration-300 group-hover:scale-110 sm:h-20 sm:w-20" />
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="text-sm font-semibold sm:text-base">{t.catPlural[key]}</div>
                    <div className="mt-0.5 text-xs text-muted">{t.parts.tile(items.length, t.money(Math.min(...items.map((p) => p.price))))}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
