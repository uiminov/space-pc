import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getComponent } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { ComponentForm } from "./ComponentForm";
import { deleteComponent } from "../../../actions";
import { unlinkOffer } from "../../../supplierActions";
import { supplierName } from "@/lib/suppliers";
import { formatNumber } from "@/lib/format";

export default async function EditComponent({ params, searchParams }: PageProps<"/admin/components/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === "new";
  const c = isNew ? null : getComponent(Number(id));
  if (!isNew && !c) notFound();
  const s = getSettings();
  const usedIn = c
    ? (db().prepare("SELECT b.id, b.name FROM build_items bi JOIN builds b ON b.id = bi.build_id WHERE bi.component_id = ?").all(c.id) as { id: number; name: string }[])
    : [];
  const offers = c
    ? (db()
        .prepare(
          `SELECT p.code, p.name, p.price, p.in_stock, p.supplier FROM component_offers o JOIN price_items p ON p.code = o.price_code
           WHERE o.component_id = ? ORDER BY p.price`,
        )
        .all(c.id) as { code: string; name: string; price: number; in_stock: number; supplier: string }[])
    : [];

  return (
    <div className="max-w-3xl">
      <nav className="text-sm text-muted">
        <Link href="/admin/components" className="hover:text-text">Комплектующие</Link> / {isNew ? "Новая" : c!.name}
      </nav>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{isNew ? "Новая комплектующая" : c!.name}</h1>
        {c ? (
          <form action={deleteComponent}>
            <input type="hidden" name="id" value={c.id} />
            <button className="btn-danger" title={usedIn.length ? "Используется в сборках — будет скрыта, а не удалена" : ""}>
              {usedIn.length ? "Скрыть" : "Удалить"}
            </button>
          </form>
        ) : null}
      </div>
      {sp.saved ? <p className="mt-3 text-sm text-ok">Сохранено ✓</p> : null}
      <ComponentForm
        c={
          c
            ? {
                id: c.id,
                category: c.category,
                name: c.name,
                brand: c.brand ?? "",
                price_code: c.price_code ?? "",
                manual_price: c.manual_price,
                specs: c.specs,
                image: c.image,
                active: !!c.active,
                supplier_name: c.supplier_name,
                supplier_price: c.supplier_price,
                cost: c.cost,
                in_stock: c.in_stock,
              }
            : null
        }
        currency={s.price_currency}
      />
      {offers.length > 1 ? (
        <section className="card mt-6 p-5">
          <h2 className="font-semibold">Предложения поставщиков</h2>
          <p className="mt-1 text-xs text-muted">
            Этот товар есть у нескольких поставщиков. Цена на сайте считается по отмеченному (главный поставщик, если у него есть в наличии).
          </p>
          <ul className="mt-3 divide-y divide-line text-sm">
            {offers.map((o) => (
              <li key={o.code} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-16 shrink-0 font-semibold">{supplierName(o.supplier)}</span>
                <span className="min-w-0 flex-1 text-xs text-muted">{o.name}</span>
                <span className="whitespace-nowrap">
                  {o.price > 0 ? `$${formatNumber(o.price)}` : "нет цены"} {o.in_stock ? "" : <span className="text-warn">· нет</span>}
                </span>
                {o.code === c?.price_code ? (
                  <span className="rounded bg-ok/15 px-2 py-0.5 text-xs font-semibold text-ok">цена отсюда</span>
                ) : (
                  <form action={unlinkOffer}>
                    <input type="hidden" name="component_id" value={c!.id} />
                    <input type="hidden" name="code" value={o.code} />
                    <button className="text-xs text-muted hover:text-danger" title="Это другой товар — отвязать">отвязать</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {usedIn.length ? (
        <div className="mt-6 text-sm text-muted">
          Используется в сборках:{" "}
          {usedIn.map((b, i) => (
            <span key={b.id}>
              {i ? ", " : ""}
              <Link href={`/admin/builds/${b.id}`} className="text-text hover:text-accent">{b.name}</Link>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
