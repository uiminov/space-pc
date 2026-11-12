import type { Metadata } from "next";
import { listComponents, pricing, getBuildBySlug } from "@/lib/repo";
import { Configurator, type ConfOption } from "./Configurator";
import { getT } from "@/lib/i18n/server";

// в конфигуратор идут только комплектующие ПК (без ноутбуков, периферии и т. п.)
const PC_CATS = new Set(["cpu", "cooler", "mb", "ram", "gpu", "ssd", "hdd", "psu", "case"]);

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.configurator };
}

export default async function ConfiguratorPage({ searchParams }: PageProps<"/configurator">) {
  const { from, view } = await searchParams;
  const { t } = await getT();
  const pr = pricing();
  const comps = listComponents({ activeOnly: true });
  const options: ConfOption[] = comps
    .filter((c) => c.cost != null && PC_CATS.has(c.category))
    .map((c) => ({
      id: c.id,
      category: c.category,
      name: c.name.replace(/\s*\(на количестве[^)]*\)/i, ""),
      specs: c.specs,
      image: c.image,
      price: c.cost! * (1 + (c.markup_percent ?? pr.markup) / 100),
      inStock: c.in_stock,
    }));
  let initial: Record<string, number> = {};
  if (typeof from === "string") {
    const b = getBuildBySlug(from);
    if (b) for (const it of b.items) initial[it.category] = it.id;
  }
  if (!Object.keys(initial).length) initial = {};
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="font-display text-2xl font-semibold sm:text-4xl">{t.conf.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t.conf.sub}</p>
      <Configurator options={options} initial={initial} assembly={pr.assembly} roundTo={pr.roundTo} scene={view === "draw" ? "draw" : "photo"} />
    </div>
  );
}
