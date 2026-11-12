import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPart, listParts, installment } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { SPEC_FIELDS } from "@/lib/catalog";
import { getT } from "@/lib/i18n/server";
import { locSpec, type Dict } from "@/lib/i18n/dict";
import { ProductImage } from "@/components/ProductImage";
import { PartCard } from "@/components/PartCard";
import { AddToCart } from "@/components/CartButtons";
import { MoneyText } from "@/components/MoneyText";
import { OrderForm } from "@/components/OrderForm";

const idOf = (raw: string) => parseInt(raw, 10) || 0;

export async function generateMetadata({ params }: PageProps<"/part/[id]">): Promise<Metadata> {
  const p = getPart(idOf((await params).id));
  if (!p) return {};
  const { t } = await getT();
  return { title: `${p.name} — ${t.money(p.price)}`, description: t.meta.partDesc(t.cat[p.category] ?? "", p.name) };
}

// Что подходит к этому товару (по сокету и типу памяти)
function related(p: NonNullable<ReturnType<typeof getPart>>, t: Dict) {
  const pick = (category: string, specs: Record<string, string>, title: string) => {
    const items = listParts({ category, specs }).items.filter((x) => x.id !== p.id).slice(0, 4);
    return items.length ? { title, category, specs, items } : null;
  };
  const out = [];
  if (p.category === "cpu" && p.specs.socket) out.push(pick("mb", { socket: p.specs.socket }, t.part.mbFor(p.specs.socket)));
  if (p.category === "mb") {
    if (p.specs.socket) out.push(pick("cpu", { socket: p.specs.socket }, t.part.cpuFor(p.specs.socket)));
    if (p.specs.ram_type) out.push(pick("ram", { ram_type: p.specs.ram_type }, t.part.ramFor(p.specs.ram_type)));
  }
  if (p.category === "ram" && p.specs.ram_type) out.push(pick("mb", { ram_type: p.specs.ram_type }, t.part.mbWithRam(p.specs.ram_type)));
  if (p.category === "gpu") {
    // та же формула, что в конфигураторе: (CPU ~125 Вт + GPU) × 1.3 + 120, округление до 50
    const need = Math.ceil(((125 + (parseInt(p.specs.tdp) || 200)) * 1.3 + 120) / 50) * 50;
    const psus = listParts({ category: "psu" })
      .items.filter((x) => (parseInt(x.specs.wattage) || 0) >= need)
      .slice(0, 4);
    if (psus.length) out.push({ title: t.part.psuFor(need), category: "psu", specs: {}, items: psus });
  }
  return out.filter(Boolean) as NonNullable<ReturnType<typeof pick>>[];
}

export default async function PartPage({ params }: PageProps<"/part/[id]">) {
  const p = getPart(idOf((await params).id));
  if (!p) notFound();
  const { lang, t } = await getT();
  const s = getSettings();
  const inst = installment(p.price, s);
  const fields = SPEC_FIELDS[p.category] ?? [];
  const specRows = [
    ...(p.brand ? [{ label: t.spec.brand, value: p.brand }] : []),
    ...fields.filter((f) => p.specs[f.key]).map((f) => ({ label: t.spec[f.key === "form_factor" && p.category === "case" ? "boards" : f.key] ?? f.label, value: locSpec(p.specs[f.key], lang) })),
    // артикул — только у AGE (это код производителя); коды Darian (HP00425) — внутренние номера поставщика
    ...(p.price_code && !p.price_code.startsWith("darian:") && p.price_code !== p.supplier_name ? [{ label: t.spec.article, value: p.price_code }] : []),
  ];
  const rel = related(p, t);

  return (
    <div className="container-x py-8">
      <nav className="text-sm text-muted">
        <Link href="/parts" className="hover:text-text">{t.parts.title}</Link> <span className="mx-1">/</span>{" "}
        <Link href={`/parts/${p.category}`} className="hover:text-text">{t.catPlural[p.category] ?? p.category}</Link>
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <ProductImage src={p.image} alt={p.name} category={p.category} className="card aspect-[4/3]" pad="p-8" iconClass="h-40 w-40" eager sizes="(min-width: 1024px) 700px, 100vw" />
          {specRows.length ? (
            <>
              <h2 className="font-display mt-10 text-xl font-semibold">{t.part.specs}</h2>
              <dl className="card mt-4 divide-y divide-line">
                {specRows.map((r) => (
                  <div key={r.label} className="grid grid-cols-[160px_1fr] gap-3 px-5 py-3 text-sm">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className="break-words">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : null}
          {p.supplier_name && p.supplier_name !== p.name ? (
            <p className="mt-3 text-xs text-muted">{t.part.fullName(p.supplier_name)}</p>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <span className="badge bg-surface-2 text-muted">{t.cat[p.category] ?? p.category}</span>
            <h1 className="font-display mt-3 text-2xl leading-tight font-semibold">{p.name}</h1>
            <div className="mt-5 font-display text-2xl font-semibold sm:text-3xl"><MoneyText text={t.money(p.price)} /></div>
            <div className="mt-1 text-sm text-muted">{t.part.orPerMonth(t.money(inst.monthly), inst.months)}</div>
            <div className={`mt-2 text-sm ${p.in_stock ? "text-ok" : "text-warn"}`}>● {p.in_stock ? t.card.inStock : t.card.onOrder}</div>
            <div className="mt-5">
              <AddToCart id={p.id} />
            </div>
            <details className="mt-5 border-t border-line pt-5">
              <summary className="cursor-pointer text-sm font-semibold">{t.part.buy1}</summary>
              <div className="mt-4">
                <OrderForm hidden={{ source: "cart", cart: JSON.stringify([{ id: p.id, qty: 1 }]) }} submitLabel={t.part.order} />
              </div>
            </details>
          </div>
          <ul className="mt-4 space-y-2 px-1 text-sm text-muted">
            {t.part.perks.map((x) => (
              <li key={x}>✓ {x}</li>
            ))}
            <li>
              ✓ {t.part.install}{" "}
              <Link href="/configurator" className="text-text underline">
                {t.part.installLink}
              </Link>
            </li>
          </ul>
        </aside>
      </div>

      {rel.map((r) => (
        <section key={r.title} className="mt-8 sm:mt-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-display text-xl font-semibold">{r.title}</h2>
            <Link
              href={`/parts/${r.category}?${new URLSearchParams(Object.fromEntries(Object.entries(r.specs).map(([k, v]) => [`f_${k}`, v])))}`}
              className="text-sm text-muted hover:text-text"
            >
              {t.part.all}
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {r.items.map((x) => (
              <PartCard key={x.id} p={{ id: x.id, name: x.name, category: x.category, image: x.image, price: x.price, inStock: x.in_stock, specs: x.specs }} lang={lang} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
