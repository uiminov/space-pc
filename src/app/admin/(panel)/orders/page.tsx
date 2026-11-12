import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ORDER_STATUSES, categoryLabel, statusLabel } from "@/lib/catalog";
import { formatDate, formatSum } from "@/lib/format";
import { deleteOrder, setOrderStatus } from "../../actions";
import { StatusSelect } from "./StatusSelect";

type Order = {
  id: number;
  created_at: string;
  name: string;
  phone: string;
  comment: string | null;
  source: string;
  title: string;
  items: string;
  total: number;
  status: string;
  company: string | null;
  inn: string | null;
  segment: string | null;
  qty: number | null;
};

const SEGMENTS: Record<string, string> = { club: "Компьютерный клуб", it: "IT-компания", edu: "Учебный центр", studio: "Дизайн, 3D и видео", office: "Офис" };

const COLORS: Record<string, string> = {
  new: "bg-accent text-accent-ink",
  contacted: "bg-[#3b82f6]/15 text-[#7fb0ff]",
  paid: "bg-ok/10 text-ok",
  assembling: "bg-warn/10 text-warn",
  done: "bg-surface-2 text-muted",
  cancelled: "bg-danger/10 text-danger",
};

export default async function OrdersAdmin({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" ? sp.status : "";
  const b2b = sp.type === "b2b";
  const orders = db()
    .prepare(`SELECT * FROM orders WHERE 1=1 ${status ? "AND status = ?" : ""} ${b2b ? "AND source = 'b2b'" : ""} ORDER BY id DESC LIMIT 200`)
    .all(...(status ? [status] : [])) as Order[];

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-semibold">Заказы</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/admin/orders" className={`chip ${!status && !b2b ? "chip-on" : ""}`}>Все</Link>
        <Link href="/admin/orders?type=b2b" className={`chip ${b2b ? "chip-on" : ""}`}>🏢 Заявки компаний</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s.key} href={`/admin/orders?status=${s.key}`} className={`chip ${status === s.key ? "chip-on" : ""}`}>
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {orders.map((o) => {
          const items = JSON.parse(o.items) as { category: string; name: string; qty: number; code: string | null }[];
          return (
            <details key={o.id} className="card group" open={o.status === "new"}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <span className="font-mono text-sm text-muted">№{o.id}</span>
                <span className={`badge ${COLORS[o.status] ?? ""}`}>{statusLabel(o.status)}</span>
                {o.source === "b2b" ? <span className="badge bg-surface-2 text-text">🏢 B2B</span> : null}
                <span className="font-semibold">{o.company ? `${o.company} · ${o.name}` : o.name}</span>
                <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} className="text-sm text-accent">{o.phone}</a>
                <span className="text-sm text-muted">{o.title}</span>
                <span className="ml-auto font-semibold whitespace-nowrap">{o.total ? formatSum(o.total) : "расчёт КП"}</span>
                <span className="text-xs text-muted">{formatDate(o.created_at)}</span>
              </summary>
              <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-[1fr_220px]">
                <div>
                  {o.source === "b2b" ? (
                    <dl className="mb-3 grid grid-cols-[120px_1fr] gap-x-3 gap-y-1 text-sm">
                      {o.company ? (<><dt className="text-muted">Компания</dt><dd>{o.company}</dd></>) : null}
                      {o.inn ? (<><dt className="text-muted">ИНН</dt><dd className="font-mono">{o.inn}</dd></>) : null}
                      <dt className="text-muted">Сфера</dt><dd>{(o.segment && SEGMENTS[o.segment]) || "—"}</dd>
                      {o.qty ? (<><dt className="text-muted">Количество</dt><dd>{o.qty} ПК</dd></>) : null}
                      
                    </dl>
                  ) : null}
                  <ul className="space-y-1 text-sm">
                    {items.map((i, idx) => (
                      <li key={idx} className="flex gap-3">
                        <span className="w-40 shrink-0 text-muted">{categoryLabel(i.category)}</span>
                        <span>
                          {i.name}
                          {i.qty > 1 ? ` × ${i.qty}` : ""}
                          {i.code ? <span className="ml-2 font-mono text-xs text-muted">{i.code}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {o.comment ? <p className="mt-3 rounded-lg bg-bg p-3 text-sm">💬 {o.comment}</p> : null}
                </div>
                <div className="space-y-2">
                  <StatusSelect id={o.id} status={o.status} action={setOrderStatus} />
                  <form action={deleteOrder}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="text-xs text-muted hover:text-danger">Удалить заказ</button>
                  </form>
                </div>
              </div>
            </details>
          );
        })}
        {!orders.length ? <div className="card p-10 text-center text-sm text-muted">Заказов пока нет</div> : null}
      </div>
    </div>
  );
}
