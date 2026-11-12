import Link from "next/link";
import { partHref } from "@/lib/format";
import { DICTS, locSpec, type Lang } from "@/lib/i18n/dict";
import { ProductImage } from "./ProductImage";
import { MoneyText } from "./MoneyText";
import { AddToCart } from "./CartButtons";

export type PartCardData = {
  id: number;
  name: string;
  category: string;
  image: string | null;
  price: number;
  inStock: boolean;
  specs: Record<string, string>;
};

const SKIP = new Set(["igpu"]);

export function PartCard({ p, lang }: { p: PartCardData; lang: Lang }) {
  const t = DICTS[lang];
  const specs = Object.entries(p.specs)
    .filter(([k, v]) => v && !SKIP.has(k))
    .map(([k, v]) => (k === "wattage" || k === "tdp" ? `${v} ${t.spec.wattShort}` : locSpec(v, lang)))
    .slice(0, 3)
    .join(" · ");
  return (
    <div className="group card flex flex-col overflow-hidden transition-colors hover:border-line-2">
      <Link href={partHref(p.id, p.name)} className="block border-b border-line">
        <ProductImage src={p.image} alt={p.name} category={p.category} iconClass="h-20 w-20" zoom />
      </Link>
      <div className="flex flex-1 flex-col p-4">
        {/* название — всегда ровно две строки, характеристики — одна: цена и кнопка у всех карточек на одной высоте */}
        <Link href={partHref(p.id, p.name)} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 hover:underline">
          {p.name}
        </Link>
        <p className="mt-1 line-clamp-1 min-h-4 text-xs leading-4 text-muted">{specs}</p>
        <div className="mt-auto pt-4">
          <div className="font-display text-base font-semibold sm:text-lg"><MoneyText text={t.money(p.price)} /></div>
          <div className={`text-xs ${p.inStock ? "text-ok" : "text-warn"}`}>{p.inStock ? t.card.inStock : t.card.onOrder}</div>
          <div className="mt-3">
            <AddToCart id={p.id} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
