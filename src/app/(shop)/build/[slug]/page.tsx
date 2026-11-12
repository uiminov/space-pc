import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBuildBySlug, installment, locBuild } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { partHref } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { locSpec, type Lang } from "@/lib/i18n/dict";
import { PcArt } from "@/components/PcArt";
import { OrderForm } from "@/components/OrderForm";
import { MoneyText } from "@/components/MoneyText";
import { ProductImage } from "@/components/ProductImage";

export async function generateMetadata({ params }: PageProps<"/build/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const b = getBuildBySlug(slug);
  if (!b) return {};
  const { lang, t } = await getT();
  const L = locBuild(b, lang);
  return {
    title: t.meta.build(L.name, b.price ? t.money(b.price) : ""),
    description: L.tagline ?? L.description ?? undefined,
  };
}

// Короткая строка характеристик детали: «AM5 · 8/16 · 120 Вт»
function specLine(specs: Record<string, string>, lang: Lang, watt: string) {
  const keys = ["socket", "cores", "tdp", "ram_type", "form_factor", "capacity", "speed", "vram", "wattage", "cert", "type"];
  return keys
    .filter((k) => specs[k])
    .map((k) => (k === "tdp" || k === "wattage" ? `${specs[k]} ${watt}` : locSpec(specs[k], lang)))
    .join(" · ");
}

export default async function BuildPage({ params }: PageProps<"/build/[slug]">) {
  const { slug } = await params;
  const b = getBuildBySlug(slug);
  if (!b || !b.active) notFound();
  const { lang, t } = await getT();
  const L = locBuild(b, lang);
  const s = getSettings();
  const inst = b.price ? installment(b.price, s) : null;
  const heroImage = b.image ?? b.byCategory.case?.[0]?.image ?? null;

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-muted">
        <Link href="/catalog" className="hover:text-text">{t.build.crumbs}</Link> <span className="mx-1">/</span> {L.name}
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          <div className="card overflow-hidden">
            <div className={`aspect-[16/10] ${heroImage && !b.image ? "bg-studio" : "bg-surface-2"}`}>
              {heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt={L.name} className={`h-full w-full ${b.image ? "object-cover" : "object-contain p-8 mix-blend-multiply"}`} />
              ) : (
                <PcArt seed={b.id} className="h-full w-full" />
              )}
            </div>
          </div>

          <div className="mt-5 lg:hidden">
            <h1 className="font-display text-2xl font-bold">{L.name}</h1>
            {L.tagline ? <p className="mt-1 text-sm text-muted">{L.tagline}</p> : null}
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-xl font-bold">{b.price ? <MoneyText text={t.money(b.price)} /> : t.card.priceOnRequest}</div>
                {inst ? <div className="text-xs text-muted">{t.build.orPerMonth(t.money(inst.monthly), inst.months)}</div> : null}
              </div>
              <a href="#order" className="btn-accent shrink-0 px-4 py-3">{t.order.submit}</a>
            </div>
          </div>

          <h2 className="font-display mt-10 text-xl font-bold">{t.build.config}</h2>
          <div className="card mt-4 divide-y divide-line">
            {b.items.map((it) => (
              <div key={it.id} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[180px_64px_1fr]">
                <div className="text-sm text-muted">{t.cat[it.category] ?? it.category}</div>
                <ProductImage src={it.image} category={it.category} className="hidden h-14 w-16 rounded-lg sm:block" pad="p-1" iconClass="h-8 w-8" sizes="64px" />
                <div>
                  <div className="font-medium">
                    <Link href={partHref(it.id, it.name)} className="hover:underline">{it.name}</Link>
                    {it.qty > 1 ? <span className="text-muted"> × {it.qty}</span> : null}
                  </div>
                  {specLine(it.specs, lang, t.spec.wattShort) ? (
                    <div className="mt-0.5 text-sm text-muted">{specLine(it.specs, lang, t.spec.wattShort)}</div>
                  ) : null}
                </div>
              </div>
            ))}
            <div className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_64px_1fr]">
              <div className="text-sm text-muted">{t.build.services}</div>
              <div className="hidden sm:block" />
              <div className="text-sm">{t.build.servicesText}</div>
            </div>
          </div>

          {L.fps ? (
            <>
              <h2 className="font-display mt-10 text-xl font-bold">{t.build.fpsTitle}</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {L.fps.split(/,\s*/).map((f) => (
                  <span key={f} className="rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">{f}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">{t.build.fpsNote}</p>
            </>
          ) : null}

          {L.description ? (
            <>
              <h2 className="font-display mt-10 text-xl font-bold">{t.build.desc}</h2>
              <p className="mt-3 whitespace-pre-line text-muted">{L.description}</p>
            </>
          ) : null}
        </div>

        <aside id="order" className="scroll-mt-20 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="flex items-center gap-2">
              <span className="badge bg-surface-2 text-muted">{t.purpose[b.purpose] ?? b.purpose}</span>
              <span className={`badge ${b.available ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}>
                {b.available ? t.card.inStock : t.card.onOrder}
              </span>
            </div>
            <h2 className="font-display mt-3 text-3xl font-bold max-lg:text-2xl">{L.name}</h2>
            {L.tagline ? <p className="mt-1 text-muted">{L.tagline}</p> : null}
            <div className="mt-6">
              {b.price ? (
                <>
                  <div className="font-display text-2xl font-bold sm:text-3xl"><MoneyText text={t.money(b.price)} /></div>
                  {inst ? <div className="mt-1 text-sm text-muted">{t.build.orPerMonth(t.money(inst.monthly), inst.months)}</div> : null}
                </>
              ) : (
                <div className="text-lg text-muted">{t.card.priceOnRequest}</div>
              )}
            </div>
            <div className="mt-6 border-t border-line pt-6">
              <OrderForm hidden={{ source: "build", slug: b.slug }} />
            </div>
          </div>
          <ul className="mt-4 space-y-2 px-1 text-sm text-muted">
            {t.build.perks.map((p) => (
              <li key={p}>✓ {p}</li>
            ))}
            <li>
              ✓ {t.build.swap}{" "}
              <Link href={`/configurator?from=${b.slug}`} className="text-text underline">
                {t.build.swapLink}
              </Link>
            </li>
          </ul>
        </aside>
      </div>
    </div>
  );
}
