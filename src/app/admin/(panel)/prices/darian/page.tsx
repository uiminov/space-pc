import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDate, formatNumber, formatSum } from "@/lib/format";
import { pricing, roundUp } from "@/lib/repo";
import { displayCode, supplierName, supplierOrder, SUPPLIERS } from "@/lib/suppliers";
import { DarianImportForm } from "./DarianImportForm";
import { resolveMatch, setMainSupplier } from "../../../supplierActions";

const PAGE = 50;
const STATUS = [
  ["", "Все"],
  ["site", "На сайте"],
  ["merged", "Привязаны к товару AGE"],
  ["review", "На проверке"],
  ["noprice", "Без цены («.»)"],
  ["off", "Не на сайте"],
] as const;

type Item = { code: string; name: string; price: number; stock: string | null; in_stock: number; category: string | null; note: string | null; updated_at: string; component_id: number | null; age_offer: number | null; review: number | null };

export default async function DarianPage({ searchParams }: PageProps<"/admin/prices/darian">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const s = getSettings();
  const pr = pricing(s);
  const d = db();
  const main = supplierOrder(d)[0];

  // ---------- Совпадения на проверку ----------
  const pending = d
    .prepare(
      `SELECT m.price_code, m.component_id, m.reason, p.name AS dname, p.price AS dprice,
              c.name AS cname, cp.supplier AS csupplier, cp.name AS cpname, cp.price AS cprice, cp.in_stock AS cstock
       FROM offer_matches m
       JOIN price_items p ON p.code = m.price_code
       JOIN components c ON c.id = m.component_id
       LEFT JOIN price_items cp ON cp.code = c.price_code
       WHERE m.status = 'pending' ORDER BY m.price_code`,
    )
    .all() as { price_code: string; component_id: number; reason: string; dname: string; dprice: number; cname: string; csupplier: string | null; cpname: string | null; cprice: number | null; cstock: number | null }[];
  const byCode = new Map<string, typeof pending>();
  for (const m of pending) byCode.set(m.price_code, [...(byCode.get(m.price_code) ?? []), m]);

  // ---------- Позиции прайса ----------
  const where: string[] = ["p.supplier = 'darian'"];
  const args: string[] = [];
  for (const w of q.split(/\s+/).filter(Boolean).slice(0, 5)) {
    where.push("(p.name LIKE ? OR p.code LIKE ? OR p.category LIKE ?)");
    args.push(`%${w}%`, `%${w}%`, `%${w}%`);
  }
  if (status === "site") where.push("o.component_id IS NOT NULL AND p.price > 0");
  if (status === "merged") where.push("ag.component_id IS NOT NULL");
  if (status === "review") where.push("r.price_code IS NOT NULL");
  if (status === "noprice") where.push("p.price = 0");
  if (status === "off") where.push("o.component_id IS NULL");
  const W = `WHERE ${where.join(" AND ")}`;
  const J = `
    LEFT JOIN (SELECT price_code, MIN(component_id) AS component_id FROM component_offers GROUP BY price_code) o ON o.price_code = p.code
    LEFT JOIN (SELECT DISTINCT o1.component_id FROM component_offers o1 JOIN price_items p1 ON p1.code = o1.price_code WHERE p1.supplier = 'age') ag ON ag.component_id = o.component_id
    LEFT JOIN (SELECT DISTINCT price_code FROM offer_matches WHERE status = 'pending') r ON r.price_code = p.code`;
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM price_items p ${J} ${W}`).get(...args) as { n: number }).n;
  const rows = d
    .prepare(
      `SELECT p.*, o.component_id, ag.component_id AS age_offer, CASE WHEN r.price_code IS NULL THEN NULL ELSE 1 END AS review
       FROM price_items p ${J} ${W} ORDER BY p.category, p.name LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
    )
    .all(...args) as Item[];
  const counts = d
    .prepare(
      `SELECT COUNT(*) AS all_n, SUM(price > 0) AS priced,
        SUM(EXISTS (SELECT 1 FROM component_offers o WHERE o.price_code = p.code) AND price > 0) AS on_site
       FROM price_items p WHERE supplier = 'darian'`,
    )
    .get() as { all_n: number; priced: number; on_site: number };
  const imports = d.prepare("SELECT * FROM price_imports WHERE supplier = 'darian' ORDER BY id DESC LIMIT 8").all() as {
    id: number; filename: string; created_at: string; rows_total: number; rows_new: number; rows_updated: number; rows_missing: number; mapping: string | null;
  }[];
  const pages = Math.ceil(total / PAGE);
  const link = (p: number) => `/admin/prices/darian?${new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), page: String(p) })}`;
  const retail = (usd: number) => roundUp(usd * pr.rate * (1 + pr.markup / 100), 1000);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-semibold">Прайс Darian</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Ноутбуки, моноблоки, мониторы и аксессуары. В базе {counts.all_n} позиций, {counts.priced} с ценой, {counts.on_site} на сайте.
          {s.price_currency === "USD" ? ` Курс: 1 $ = ${formatNumber(pr.rate)} сум.` : ""}
        </p>
        <a href="/admin/prices-export?s=darian" className="btn-ghost">Скачать прайс в сумах (.xlsx)</a>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <DarianImportForm />
        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="font-semibold">Главный поставщик</h2>
            <p className="mt-1 text-xs text-muted">
              Если товар есть у обоих — цена на сайте берётся у главного. Нет у него в наличии — у другого.
            </p>
            <form action={setMainSupplier} className="mt-3 flex gap-2">
              <select name="main" defaultValue={main} className="input">
                {SUPPLIERS.map((x) => (
                  <option key={x.key} value={x.key}>{x.name}</option>
                ))}
              </select>
              <button className="btn-ghost shrink-0">Сохранить</button>
            </form>
          </section>
          <section className="card p-5">
            <h2 className="font-semibold">История загрузок</h2>
            {imports.length ? (
              <ul className="mt-3 space-y-3 text-sm">
                {imports.map((i) => {
                  const m = i.mapping ? (JSON.parse(i.mapping) as { added?: number; merged?: number; review?: number }) : {};
                  return (
                    <li key={i.id}>
                      <div className="truncate">{i.filename}</div>
                      <div className="text-xs text-muted">
                        {formatDate(i.created_at)} · {i.rows_total} поз. · +{m.added ?? 0} на сайт · {m.merged ?? 0} привязано
                        {m.review ? ` · ${m.review} на проверку` : ""}
                        {i.rows_missing ? ` · ${i.rows_missing} пропало` : ""}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted">Прайс ещё не загружали.</p>
            )}
          </section>
        </div>
      </div>

      {byCode.size ? (
        <section className="mt-8">
          <h2 className="font-semibold">Проверьте совпадения ({byCode.size})</h2>
          <p className="mt-1 text-sm text-muted">
            Похоже на один и тот же товар, но по названию не всё понятно (процессор, память, накопитель). Пока вы не решите, позиция Darian на сайт не выходит.
          </p>
          <div className="mt-3 space-y-3">
            {[...byCode.entries()].map(([code, ms]) => (
              <div key={code} className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted">Darian · {displayCode(code)}</div>
                    <div className="font-medium">{ms[0].dname}</div>
                  </div>
                  <div className="text-right text-sm whitespace-nowrap">
                    <b>${formatNumber(ms[0].dprice)}</b>
                    <div className="text-xs text-muted">{formatSum(ms[0].dprice * pr.rate)}</div>
                  </div>
                </div>
                <ul className="mt-3 space-y-2 border-t border-line pt-3">
                  {ms.map((m) => (
                    <li key={m.component_id} className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-muted">
                          На сайте{m.csupplier ? ` · ${supplierName(m.csupplier)}` : ""} · {m.reason}
                        </div>
                        <Link href={`/admin/components/${m.component_id}`} className="text-sm hover:text-accent">{m.cpname || m.cname}</Link>
                      </div>
                      {m.cprice != null ? (
                        <div className="text-right text-sm whitespace-nowrap">
                          ${formatNumber(m.cprice)} {m.cstock ? "" : <span className="text-warn">нет</span>}
                        </div>
                      ) : null}
                      <form action={resolveMatch}>
                        <input type="hidden" name="code" value={code} />
                        <input type="hidden" name="component_id" value={m.component_id} />
                        <button className="rounded-lg bg-ok/10 px-3 py-1.5 text-xs font-semibold text-ok hover:bg-ok/20">Это один товар</button>
                      </form>
                    </li>
                  ))}
                </ul>
                <form action={resolveMatch} className="mt-3">
                  <input type="hidden" name="code" value={code} />
                  <button className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs hover:bg-line-2">Разные товары — выложить отдельно</button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="font-semibold">Позиции прайса ({formatNumber(total, 0)})</h2>
        <form className="mt-3 flex flex-wrap items-center gap-3">
          <input name="q" defaultValue={q} placeholder="Поиск: название, код, лист" className="input w-80" />
          <select name="status" defaultValue={status} className="input w-auto">
            {STATUS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button className="btn-ghost">Найти</button>
        </form>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Наименование</th>
                <th className="hidden px-4 py-3 xl:table-cell">Лист</th>
                <th className="px-4 py-3 text-right">Цена, $</th>
                <th className="px-4 py-3 text-right">Розница, сум</th>
                <th className="px-4 py-3">На сайте</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.code} className="hover:bg-surface-2/50">
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{displayCode(r.code) === r.name ? "—" : displayCode(r.code)}</td>
                  <td className="px-4 py-2">
                    {r.name}
                    {r.note ? <span className="ml-2 badge bg-warn/10 text-warn">{r.note}</span> : null}
                  </td>
                  <td className="hidden max-w-[140px] truncate px-4 py-2 text-xs text-muted xl:table-cell">{r.category}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{r.price > 0 ? formatNumber(r.price) : <span className="text-muted">.</span>}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-ok">{r.price > 0 ? formatSum(retail(r.price)) : ""}</td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {r.review ? (
                      <span className="text-warn">на проверке ↑</span>
                    ) : r.component_id ? (
                      <Link href={`/admin/components/${r.component_id}`} className="text-accent">
                        {r.age_offer ? "вместе с AGE →" : "открыть →"}
                      </Link>
                    ) : r.price > 0 ? (
                      <span className="text-muted">нет раздела</span>
                    ) : (
                      <span className="text-muted">нет цены</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p className="p-6 text-center text-sm text-muted">Ничего не найдено</p> : null}
        </div>
        {pages > 1 ? (
          <div className="mt-3 flex items-center gap-2 text-sm">
            {page > 1 ? <Link href={link(page - 1)} className="chip">← Назад</Link> : null}
            <span className="text-muted">Стр. {page} из {pages}</span>
            {page < pages ? <Link href={link(page + 1)} className="chip">Вперёд →</Link> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
