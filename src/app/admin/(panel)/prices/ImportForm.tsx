"use client";

import { useActionState, useState } from "react";
import { importPrices, type ImportState } from "../../actions";
import { formatNumber } from "@/lib/format";

export function ImportForm({
  defaults,
  currency,
}: {
  defaults: { code: string; name: string; price: string; stock: string; category: string; missing: string };
  currency: string;
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importPrices, undefined);
  const [showCols, setShowCols] = useState(Boolean(defaults.code || defaults.name || defaults.price));
  const r = state?.result;

  return (
    <section className="card min-w-0 p-5">
      <form action={action} className="space-y-4">
        <div>
          <label className="label">Файл прайса (.xlsx или .csv)</label>
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="w-full rounded-xl border border-dashed border-line-2 bg-bg p-4 text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-accent-ink"
          />
        </div>

        <button type="button" onClick={() => setShowCols((v) => !v)} className="text-sm text-muted hover:text-text">
          {showCols ? "▾" : "▸"} Колонки прайса {showCols ? "" : "(определяются автоматически)"}
        </button>
        {showCols ? (
          <div className="grid gap-3 sm:grid-cols-5">
            {(
              [
                ["col_code", "Код", defaults.code],
                ["col_name", "Наименование", defaults.name],
                ["col_price", "Цена", defaults.price],
                ["col_stock", "Наличие", defaults.stock],
                ["col_category", "Категория", defaults.category],
              ] as const
            ).map(([n, l, v]) => (
              <div key={n}>
                <label className="label">{l}</label>
                <input name={n} defaultValue={v} placeholder="авто" className="input" />
              </div>
            ))}
            <p className="text-xs text-muted sm:col-span-5">Буква колонки (A, B, C…) или текст заголовка. Пусто — определить автоматически.</p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Позиции, которых нет в новом прайсе</label>
            <select name="missing_mode" defaultValue={defaults.missing} className="input">
              <option value="out_of_stock">Пометить «нет в наличии»</option>
              <option value="keep">Оставить как есть</option>
              <option value="delete">Удалить из базы</option>
            </select>
          </div>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" name="dry_run" value="1" /> Только проверить (не сохранять)
          </label>
        </div>

        <button className="btn-accent" disabled={pending}>
          {pending ? "Загружаем…" : "Загрузить прайс"}
        </button>
      </form>

      {state?.error ? <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{state.error}</p> : null}

      {r ? (
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <p className={`text-sm ${r.dryRun ? "text-warn" : "text-ok"}`}>
            {r.dryRun ? "Проверка: файл прочитан, в базу ничего не записано." : "Прайс загружен ✓"}
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-bg p-3"><div className="text-xs text-muted">Позиций</div><b>{r.total}</b></div>
            <div className="rounded-xl bg-bg p-3"><div className="text-xs text-muted">Новых</div><b>{r.created}</b></div>
            <div className="rounded-xl bg-bg p-3"><div className="text-xs text-muted">Обновлено</div><b>{r.updated}</b></div>
            <div className="rounded-xl bg-bg p-3"><div className="text-xs text-muted">Нет в прайсе</div><b>{r.missing}</b></div>
          </div>
          <div className="text-xs text-muted">
            Код: {r.columns.code ?? "нет (используется наименование)"} · Наименование: {r.columns.name} · Цена: {r.columns.price} · Наличие: {r.columns.stock ?? "нет"}
            {r.skipped ? ` · пропущено строк: ${r.skipped}` : ""}
          </div>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-xs">
              <thead className="text-left text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2">Код</th>
                  <th className="px-3 py-2">Наименование</th>
                  <th className="px-3 py-2">Раздел</th>
                  <th className="px-3 py-2 text-right">Цена, {currency}</th>
                  <th className="px-3 py-2">Нал.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.sample.map((x) => (
                  <tr key={x.code}>
                    <td className="px-3 py-1.5 font-mono">{x.code}</td>
                    <td className="px-3 py-1.5">{x.name}</td>
                    <td className="px-3 py-1.5 text-muted">{x.category}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(x.price)}</td>
                    <td className="px-3 py-1.5">{x.inStock ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Первые 15 строк. Если колонки определились неверно — укажите их вручную и загрузите снова.</p>
        </div>
      ) : null}
    </section>
  );
}
