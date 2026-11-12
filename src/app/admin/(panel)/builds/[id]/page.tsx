import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getBuild, listComponents, pricing } from "@/lib/repo";
import { BuildEditor, type EditorComponent } from "./BuildEditor";
import { deleteBuild, duplicateBuild } from "../../../actions";

export default async function EditBuild({ params, searchParams }: PageProps<"/admin/builds/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { saved } = await searchParams;
  const isNew = id === "new";
  const b = isNew ? null : getBuild(Number(id));
  if (!isNew && !b) notFound();
  const pr = pricing();
  const comps: EditorComponent[] = listComponents()
    .filter((c) => c.active || b?.items.some((i) => i.id === c.id))
    .map((c) => ({ id: c.id, category: c.category, name: c.name, cost: c.cost, inStock: c.in_stock, code: c.price_code }));

  return (
    <div className="max-w-6xl">
      <nav className="text-sm text-muted">
        <Link href="/admin/builds" className="hover:text-text">Сборки</Link> / {isNew ? "Новая" : b!.name}
      </nav>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{isNew ? "Новая сборка" : b!.name}</h1>
        {!isNew ? (
          <div className="flex gap-2">
            <Link href={`/build/${b!.slug}`} target="_blank" className="btn-ghost">На сайте ↗</Link>
            <form action={duplicateBuild}>
              <input type="hidden" name="id" value={b!.id} />
              <button className="btn-ghost">Дублировать</button>
            </form>
            <form action={deleteBuild}>
              <input type="hidden" name="id" value={b!.id} />
              <button className="btn-danger">Удалить</button>
            </form>
          </div>
        ) : null}
      </div>
      {saved ? <p className="mt-3 text-sm text-ok">Сохранено ✓</p> : null}
      <BuildEditor
        build={
          b
            ? {
                id: b.id,
                name: b.name,
                slug: b.slug,
                tagline: b.tagline ?? "",
                description: b.description ?? "",
                purpose: b.purpose,
                image: b.image,
                markup_percent: b.markup_percent,
                assembly_fee: b.assembly_fee,
                extra_price: b.extra_price,
                fps: b.fps ?? "",
                name_uz: b.name_uz ?? "",
                tagline_uz: b.tagline_uz ?? "",
                description_uz: b.description_uz ?? "",
                fps_uz: b.fps_uz ?? "",
                featured: !!b.featured,
                active: !!b.active,
                sort: b.sort,
                items: b.items.map((i) => ({ component_id: i.id, qty: i.qty })),
                problems: b.problems,
              }
            : null
        }
        components={comps}
        defaults={{ markup: pr.markup, assembly: pr.assembly, roundTo: pr.roundTo }}
      />
    </div>
  );
}
