import Link from "next/link";
import { PcArt } from "./PcArt";
import { ProductImage } from "./ProductImage";
import { MoneyText } from "./MoneyText";
import { DICTS, type Lang } from "@/lib/i18n/dict";

export type BuildCardData = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  purpose: string;
  image: string | null;
  price: number | null;
  available: boolean;
  featured: number;
  specs: { label: string; value: string }[];
  monthly?: number;
  months?: number;
};

export function BuildCard({ b, lang }: { b: BuildCardData; lang: Lang }) {
  const t = DICTS[lang];
  return (
    <Link
      href={`/build/${b.slug}`}
      className="group card flex flex-col overflow-hidden transition-colors hover:border-line-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-surface-2 sm:aspect-[4/3]">
        {b.image ? (
          <ProductImage src={b.image} alt={b.name} className="absolute inset-0" pad="p-4 sm:p-6" zoom sizes="(min-width: 1024px) 400px, (min-width: 640px) 50vw, 100vw" />
        ) : (
          <PcArt seed={b.id} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="badge bg-bg/80 text-muted backdrop-blur">{t.purpose[b.purpose] ?? b.purpose}</span>
          {b.featured ? <span className="badge bg-accent text-accent-ink">{t.card.hit}</span> : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="font-display text-xl font-semibold">{b.name}</h3>
        {b.tagline ? <p className="mt-1 text-sm text-muted">{b.tagline}</p> : null}
        <dl className="mt-3 space-y-1 font-mono text-xs sm:mt-4 sm:space-y-1.5">
          {b.specs.map((s) => (
            <div key={s.label} className="flex gap-3">
              <dt className="w-12 shrink-0 text-muted">{s.label}</dt>
              <dd className="truncate">{s.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4 sm:pt-5">
          <div>
            {b.price != null ? (
              <>
                <div className="font-display text-lg font-semibold"><MoneyText text={t.money(b.price)} /></div>
                {b.monthly ? (
                  <div className="text-xs text-muted">
                    {t.card.perMonth(t.money(b.monthly), b.months ?? 12)}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="text-sm text-muted">{t.card.priceOnRequest}</div>
            )}
          </div>
          <span
            className={`badge shrink-0 ${b.available ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}
          >
            {b.available ? t.card.inStock : t.card.onOrder}
          </span>
        </div>
      </div>
    </Link>
  );
}
