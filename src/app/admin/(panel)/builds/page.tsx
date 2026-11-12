import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listBuilds, cpuOf, gpuOf, pricing } from "@/lib/repo";
import { formatSum } from "@/lib/format";
import { purposeLabel } from "@/lib/catalog";

export default async function BuildsAdmin() {
  await requireAdmin();
  const pr = pricing();
  const builds = listBuilds();
  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold">Сборки</h1>
        <Link href="/admin/builds/new" className="btn-accent">+ Новая сборка</Link>
      </div>
      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Сборка</th>
              <th className="px-4 py-3">Железо</th>
              <th className="px-4 py-3 text-right">Себестоимость</th>
              <th className="px-4 py-3 text-right">Цена на сайте</th>
              <th className="px-4 py-3 text-right">Маржа</th>
              <th className="px-4 py-3">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {builds.map((b) => {
              const margin = b.price != null ? b.price - b.cost : null;
              return (
                <tr key={b.id} className="hover:bg-surface-2/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/builds/${b.id}`} className="font-semibold hover:text-accent">{b.name}</Link>
                    <div className="text-xs text-muted">
                      {purposeLabel(b.purpose)}
                      {b.featured ? " · хит" : ""}
                      {b.markup_percent != null ? ` · наценка ${b.markup_percent}%` : ""}
                    </div>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 text-xs text-muted">
                    <div className="truncate">{cpuOf(b)}</div>
                    <div className="truncate">{gpuOf(b)}</div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap text-muted">{formatSum(b.cost)}</td>
                  <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">{formatSum(b.price)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {margin != null ? (
                      <span className="text-ok">{formatSum(margin)}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {b.active ? <span className="badge bg-ok/10 text-ok">на сайте</span> : <span className="badge bg-surface-2 text-muted">скрыта</span>}
                      {b.problems.length ? (
                        <span className="badge bg-warn/10 text-warn" title={b.problems.join("\n")}>
                          проблем: {b.problems.length}
                        </span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Цена = (сумма комплектующих по прайсу × курс) × (1 + наценка) + сборка, с округлением вверх до {formatSum(pr.roundTo)}.
      </p>
    </div>
  );
}
