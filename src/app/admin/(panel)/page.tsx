import Link from "next/link";
import { db } from "@/lib/db";
import { listBuilds, listComponents } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { formatDate, formatSum, formatNumber } from "@/lib/format";

export default async function Dashboard() {
  const s = getSettings();
  const builds = listBuilds();
  const comps = listComponents({ activeOnly: true });
  const d = db();
  const orders = d.prepare("SELECT status, COUNT(*) AS c, SUM(total) AS t FROM orders GROUP BY status").all() as { status: string; c: number; t: number }[];
  const newCount = orders.find((o) => o.status === "new")?.c ?? 0;
  const totalOrders = orders.reduce((a, o) => a + o.c, 0);
  const lastImport = d.prepare("SELECT * FROM price_imports ORDER BY id DESC LIMIT 1").get() as
    | { created_at: string; filename: string; rows_total: number }
    | undefined;
  const priceCount = (d.prepare("SELECT COUNT(*) AS c FROM price_items").get() as { c: number }).c;
  const broken = builds.filter((b) => b.active && b.problems.length);
  const unpriced = comps.filter((c) => c.cost == null);

  const stat = (label: string, value: string, href?: string, hint?: string) => (
    <Link href={href ?? "#"} className="card block p-5 hover:border-line-2">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display mt-2 text-2xl font-bold">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </Link>
  );

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold">Обзор</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stat("Новые заказы", String(newCount), "/admin/orders", `всего ${totalOrders}`)}
        {stat("Активные сборки", String(builds.filter((b) => b.active).length), "/admin/builds", `всего ${builds.length}`)}
        {stat("Позиций в прайсе", formatNumber(priceCount, 0), "/admin/prices", lastImport ? `обновлён ${formatDate(lastImport.created_at)}` : "прайс ещё не загружали")}
        {stat("Курс USD", `${formatNumber(Number(s.usd_rate), 2)}`, "/admin/settings", `наценка ${s.markup_percent}% · сборка ${formatSum(Number(s.assembly_fee))}`)}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Сборки с проблемами</h2>
          <p className="text-sm text-muted">Нет цены, нет в наличии или не хватает деталей</p>
          {broken.length ? (
            <ul className="mt-4 space-y-3">
              {broken.map((b) => (
                <li key={b.id}>
                  <Link href={`/admin/builds/${b.id}`} className="font-medium hover:text-accent">{b.name}</Link>
                  <ul className="mt-1 space-y-0.5 text-sm text-warn">
                    {b.problems.slice(0, 3).map((p) => (
                      <li key={p}>• {p}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ok">Все активные сборки в порядке ✓</p>
          )}
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Комплектующие без цены</h2>
          <p className="text-sm text-muted">Код не найден в прайсе AGE и не задана ручная цена</p>
          {unpriced.length ? (
            <ul className="mt-4 space-y-1.5 text-sm">
              {unpriced.slice(0, 12).map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <Link href={`/admin/components/${c.id}`} className="truncate hover:text-accent">{c.name}</Link>
                  <span className="shrink-0 text-muted">{c.price_code || "без кода"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-ok">У всех комплектующих есть цена ✓</p>
          )}
        </section>
      </div>
    </div>
  );
}
