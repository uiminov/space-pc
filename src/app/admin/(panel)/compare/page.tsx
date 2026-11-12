import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDate, formatNumber, formatSum } from "@/lib/format";
import { pricing } from "@/lib/repo";
import { displayCode, supplierName, SUPPLIERS } from "@/lib/suppliers";
import { CompareSearch } from "./CompareSearch";

// Сравнение цен поставщиков для закупщика: по каждой строке запроса — все позиции всех прайсов,
// одинаковые товары сгруппированы (связанные в одну карточку), лучший вариант — в наличии и дешевле всех.

type Offer = { code: string; name: string; price: number; in_stock: number; supplier: string; updated_at: string; component_id: number | null };
type Group = { key: string; title: string; component_id: number | null; offers: Offer[]; best: Offer | null };

const MAX_LINES = 30;
const MAX_GROUPS = 8;

const OFFER_SQL = `SELECT p.code, p.name, p.price, p.in_stock, p.supplier, p.updated_at,
  (SELECT MIN(component_id) FROM component_offers o WHERE o.price_code = p.code) AS component_id FROM price_items p`;

// Строка запроса: «#c123» — товар сайта (все его предложения), «#p<код>» — позиция прайса, иначе — слова поиска
function search(q: string, onlyStock: boolean): Group[] {
  let found: Offer[];
  if (/^#c\d+$/.test(q)) {
    found = db()
      .prepare(`${OFFER_SQL} WHERE p.code IN (SELECT price_code FROM component_offers WHERE component_id = ?)`)
      .all(Number(q.slice(2))) as Offer[];
  } else if (q.startsWith("#p")) {
    found = db().prepare(`${OFFER_SQL} WHERE p.code = ?`).all(q.slice(2)) as Offer[];
  } else {
    const words = q.split(/\s+/).filter(Boolean).slice(0, 6);
    if (!words.length) return [];
    const where = words.map(() => "(p.name LIKE ? OR p.code LIKE ?)");
    const args = words.flatMap((w) => [`%${w}%`, `%${w}%`]);
    if (onlyStock) where.push("p.in_stock = 1 AND p.price > 0");
    found = db().prepare(`${OFFER_SQL} WHERE ${where.join(" AND ")} ORDER BY p.price LIMIT 200`).all(...args) as Offer[];
  }
  // к найденным добавляем остальные предложения тех же товаров (у другого поставщика название может не совпасть с запросом)
  const comps = [...new Set(found.map((f) => f.component_id).filter((x): x is number => x != null))];
  const extra = comps.length
    ? (db()
        .prepare(
          `SELECT p.code, p.name, p.price, p.in_stock, p.supplier, p.updated_at, o.component_id
           FROM component_offers o JOIN price_items p ON p.code = o.price_code
           WHERE o.component_id IN (${comps.map(() => "?").join(",")})`,
        )
        .all(...comps) as Offer[])
    : [];
  const all = new Map<string, Offer>();
  for (const o of [...found, ...extra]) all.set(o.code, o);
  const groups = new Map<string, Group>();
  for (const o of all.values()) {
    const key = o.component_id != null ? `c${o.component_id}` : o.code;
    const g = groups.get(key) ?? { key, title: o.name, component_id: o.component_id, offers: [], best: null };
    g.offers.push(o);
    groups.set(key, g);
  }
  const live = (o: Offer) => o.in_stock === 1 && o.price > 0;
  for (const g of groups.values()) {
    g.offers.sort((a, b) => Number(live(b)) - Number(live(a)) || a.price - b.price);
    g.best = g.offers.find(live) ?? null;
    // заголовок — самое подробное название (у AGE обычно с характеристиками)
    g.title = [...g.offers].sort((a, b) => b.name.length - a.name.length)[0].name;
  }
  return [...groups.values()].sort(
    (a, b) => Number(!!b.best) - Number(!!a.best) || b.offers.length - a.offers.length || (a.best?.price ?? 1e9) - (b.best?.price ?? 1e9),
  );
}

export default async function ComparePage({ searchParams }: PageProps<"/admin/compare">) {
  await requireAdmin();
  const sp = await searchParams;
  const raw = typeof sp.q === "string" ? sp.q : "";
  const onlyStock = sp.stock !== "0";
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, MAX_LINES);
  const pr = pricing(getSettings());
  // выбранный товар («#c…» / «#p…») подписываем его названием, свободный текст — как есть
  const results = lines.map((key) => {
    const groups = search(key, onlyStock);
    const line = key.startsWith("#") ? (groups[0]?.title ?? key) : key;
    return { key, line, groups };
  });
  // итог: по каждой строке — лучшее предложение среди всех найденных вариантов
  const summary = results.map((r) => {
    const best = r.groups.map((g) => g.best).filter((b): b is Offer => !!b).sort((a, b) => a.price - b.price)[0] ?? null;
    return { line: r.line, best, variants: r.groups.length };
  });
  const totalUsd = summary.reduce((s, x) => s + (x.best?.price ?? 0), 0);
  const stats = db().prepare("SELECT supplier, COUNT(*) AS n, MAX(updated_at) AS at FROM price_items WHERE price > 0 GROUP BY supplier").all() as { supplier: string; n: number; at: string }[];
  const usd = (v: number) => `$${formatNumber(v, v % 1 ? 2 : 0)}`;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-bold">Сравнение цен поставщиков</h1>
      <p className="mt-1 text-sm text-muted">
        Найдите товар — покажем предложения всех поставщиков и выберем лучшее: в наличии и дешевле.
        Прайсы: {stats.map((x) => `${supplierName(x.supplier)} — ${x.n} поз. (${formatDate(x.at)})`).join(" · ") || "ещё не загружены"}.
      </p>

      <CompareSearch
        key={raw}
        initial={results.map((r) => ({ key: r.key, title: r.key.startsWith("#") ? r.line : `Все варианты: «${r.line}»` }))}
        showAll={!onlyStock}
      />

      {lines.length > 1 ? (
        <section className="mt-8">
          <h2 className="font-semibold">Итог закупки</h2>
          <div className="card mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3">Запрос</th>
                  <th className="px-4 py-3">Лучший вариант</th>
                  <th className="px-4 py-3">Поставщик</th>
                  <th className="px-4 py-3 text-right">Цена</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.map((x) => (
                  <tr key={x.line}>
                    <td className="max-w-[260px] truncate px-4 py-2 text-xs text-muted" title={x.line}>{x.line}</td>
                    <td className="px-4 py-2">{x.best ? x.best.name : <span className="text-warn">не найдено в наличии</span>}</td>
                    <td className="px-4 py-2">{x.best ? supplierName(x.best.supplier) : ""}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {x.best ? (
                        <>
                          <b>{usd(x.best.price)}</b>
                          <div className="text-xs text-muted">{formatSum(x.best.price * pr.rate)}</div>
                        </>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line-2">
                <tr>
                  <td colSpan={3} className="px-4 py-3 font-semibold">Итого по лучшим ценам</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <b>{usd(totalUsd)}</b>
                    <div className="text-xs text-muted">{formatSum(totalUsd * pr.rate)}</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      ) : null}

      {results.map((r) => (
        <section key={r.line} className="mt-8">
          <h2 className="font-semibold">
            «{r.line}» <span className="text-sm font-normal text-muted">— {r.groups.length ? `вариантов: ${r.groups.length}` : "ничего не найдено"}</span>
          </h2>
          <div className="mt-3 space-y-3">
            {r.groups.slice(0, MAX_GROUPS).map((g) => {
              const live = g.offers.filter((o) => o.in_stock === 1 && o.price > 0);
              const worst = live.length > 1 ? live[live.length - 1].price : null;
              return (
                <div key={g.key} className="card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0 font-medium">{g.title}</div>
                    {g.component_id ? (
                      <Link href={`/admin/components/${g.component_id}`} className="shrink-0 text-xs text-accent">товар на сайте →</Link>
                    ) : (
                      <span className="shrink-0 text-xs text-muted">не на сайте</span>
                    )}
                  </div>
                  <table className="mt-3 w-full text-sm">
                    <tbody className="divide-y divide-line">
                      {g.offers.map((o) => {
                        const isBest = g.best?.code === o.code;
                        return (
                          <tr key={o.code} className={isBest ? "bg-ok/5" : ""}>
                            <td className="w-24 py-2 pr-3 pl-2 font-semibold whitespace-nowrap">{supplierName(o.supplier)}</td>
                            <td className="py-2 pr-3 text-xs text-muted">
                              {o.name}
                              <span className="ml-2 font-mono">{displayCode(o.code) !== o.name ? displayCode(o.code) : ""}</span>
                            </td>
                            <td className="py-2 pr-3 text-xs whitespace-nowrap text-muted">{formatDate(o.updated_at)}</td>
                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                              {o.price > 0 ? (
                                <>
                                  <b>{usd(o.price)}</b> <span className="text-xs text-muted">{formatSum(o.price * pr.rate)}</span>
                                </>
                              ) : (
                                <span className="text-muted">нет цены</span>
                              )}
                            </td>
                            <td className="w-36 py-2 pr-2 text-right text-xs whitespace-nowrap">
                              {isBest ? (
                                <span className="rounded bg-ok/15 px-2 py-0.5 font-semibold text-ok">
                                  Лучшая цена{worst != null && worst > o.price ? ` · −${usd(worst - o.price)}` : ""}
                                </span>
                              ) : o.in_stock && o.price > 0 ? (
                                g.best ? <span className="text-muted">+{usd(o.price - g.best.price)}</span> : null
                              ) : (
                                <span className="text-warn">нет в наличии</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {g.offers.length === 1 && SUPPLIERS.length > 1 ? (
                    <p className="mt-2 text-xs text-muted">Есть только у {supplierName(g.offers[0].supplier)}.</p>
                  ) : null}
                </div>
              );
            })}
            {r.groups.length > MAX_GROUPS ? (
              <p className="text-xs text-muted">И ещё {r.groups.length - MAX_GROUPS} вариантов — уточните запрос (добавьте процессор, объём памяти, цвет).</p>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
