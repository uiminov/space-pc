import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { CATEGORIES, guessCategory } from "@/lib/catalog";
import { formatDate, formatNumber, formatSum } from "@/lib/format";
import { pricing, roundUp } from "@/lib/repo";
import { ImportForm } from "./ImportForm";
import { createComponentFromPrice } from "../../actions";

const PAGE = 50;

export default async function PricesPage({ searchParams }: PageProps<"/admin/prices">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const onlyStock = sp.stock === "1";
  const unlinked = sp.unlinked === "1";
  const page = Math.max(1, Number(sp.page) || 1);
  const s = getSettings();
  const pr = pricing(s);
  const d = db();

  const where: string[] = ["p.supplier = 'age'"];
  const args: string[] = [];
  for (const w of q.split(/\s+/).filter(Boolean).slice(0, 5)) {
    where.push("(p.name LIKE ? OR p.code LIKE ? OR p.category LIKE ?)");
    args.push(`%${w}%`, `%${w}%`, `%${w}%`);
  }
  if (onlyStock) where.push("p.in_stock = 1");
  if (unlinked) where.push("o.component_id IS NULL");
  const W = where.length ? `WHERE ${where.join(" AND ")}` : "";
  // товар на сайте, к которому привязана позиция (в т. ч. как дополнительное предложение)
  const J = "LEFT JOIN (SELECT price_code, MIN(component_id) AS component_id FROM component_offers GROUP BY price_code) o ON o.price_code = p.code";
  const total = (d.prepare(`SELECT COUNT(*) AS n FROM price_items p ${J} ${W}`).get(...args) as { n: number }).n;
  const rows = d
    .prepare(
      `SELECT p.*, o.component_id FROM price_items p ${J} ${W}
       ORDER BY p.category, p.name LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
    )
    .all(...args) as { code: string; name: string; price: number; stock: string | null; in_stock: number; category: string | null; updated_at: string; component_id: number | null }[];
  const imports = d.prepare("SELECT * FROM price_imports WHERE supplier = 'age' ORDER BY id DESC LIMIT 8").all() as {
    id: number;
    filename: string;
    created_at: string;
    rows_total: number;
    rows_new: number;
    rows_updated: number;
    rows_missing: number;
  }[];
  const pages = Math.ceil(total / PAGE);
  const link = (p: number) => `/admin/prices?${new URLSearchParams({ ...(q ? { q } : {}), ...(onlyStock ? { stock: "1" } : {}), ...(unlinked ? { unlinked: "1" } : {}), page: String(p) })}`;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold">Прайс AGE UZ</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Загрузите свежий прайс — цены и наличие всех привязанных комплектующих и сборок обновятся автоматически.
          {s.price_currency === "USD" ? ` Курс: 1 $ = ${formatNumber(pr.rate)} сум${s.usd_rate_date ? ` (ЦБ на ${s.usd_rate_date})` : ""}.` : ""}
        </p>
        <a href="/admin/prices-export?s=age" className="btn-ghost">Скачать прайс в сумах (.xlsx)</a>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ImportForm
          defaults={{
            code: s.import_col_code,
            name: s.import_col_name,
            price: s.import_col_price,
            stock: s.import_col_stock,
            category: s.import_col_category,
            missing: s.import_missing_mode,
          }}
          currency={s.price_currency}
        />
        <section className="card p-5">
          <h2 className="font-semibold">История загрузок</h2>
          {imports.length ? (
            <ul className="mt-3 space-y-3 text-sm">
              {imports.map((i) => (
                <li key={i.id}>
                  <div className="truncate">{i.filename}</div>
                  <div className="text-xs text-muted">
                    {formatDate(i.created_at)} · {i.rows_total} поз. · +{i.rows_new} новых · {i.rows_updated} обновл.
                    {i.rows_missing ? ` · ${i.rows_missing} пропало` : ""}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Прайс ещё не загружали. Сейчас в базе демо-позиции.</p>
          )}
        </section>
      </div>

      <section className="mt-8">
        <h2 className="font-semibold">Позиции прайса ({formatNumber(total, 0)})</h2>
        <form className="mt-3 flex flex-wrap items-center gap-3">
          <input name="q" defaultValue={q} placeholder="Поиск: название, код, категория" className="input w-80" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="stock" value="1" defaultChecked={onlyStock} /> в наличии
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="unlinked" value="1" defaultChecked={unlinked} /> не добавлены на сайт
          </label>
          <button className="btn-ghost">Найти</button>
        </form>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Код</th>
                <th className="px-4 py-3">Наименование</th>
                <th className="hidden px-4 py-3 xl:table-cell">Раздел прайса</th>
                <th className="px-4 py-3 text-right">Цена, {s.price_currency}</th>
                <th className="px-4 py-3 text-right">Опт, сум</th>
                <th className="px-4 py-3 text-right">Розница, сум</th>
                <th className="px-4 py-3">Наличие</th>
                <th className="px-4 py-3">На сайте</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.code} className="hover:bg-surface-2/50">
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="hidden max-w-[160px] truncate px-4 py-2 text-xs text-muted xl:table-cell">{r.category}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-muted">{formatNumber(r.price)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{formatSum(r.price * pr.rate)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap text-ok">{formatSum(roundUp(r.price * pr.rate * (1 + pr.markup / 100), 1000))}</td>
                  <td className="px-4 py-2">
                    <span className={`badge ${r.in_stock ? "bg-ok/10 text-ok" : "bg-warn/10 text-warn"}`}>{r.stock || (r.in_stock ? "есть" : "нет")}</span>
                  </td>
                  <td className="px-4 py-2">
                    {r.component_id ? (
                      <Link href={`/admin/components/${r.component_id}`} className="text-xs text-accent">открыть →</Link>
                    ) : (
                      <form action={createComponentFromPrice} className="flex gap-1">
                        <input type="hidden" name="code" value={r.code} />
                        <select name="category" defaultValue={guessCategory(r.name + " " + (r.category ?? ""))} className="rounded-lg border border-line-2 bg-bg px-1.5 py-1 text-xs">
                          {CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>{c.short}</option>
                          ))}
                        </select>
                        <button className="rounded-lg bg-surface-2 px-2 py-1 text-xs hover:bg-line-2">+ добавить</button>
                      </form>
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
