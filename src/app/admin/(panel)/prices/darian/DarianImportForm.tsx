"use client";

import { useActionState } from "react";
import { importDarian, type DarianImportState } from "../../../supplierActions";

export function DarianImportForm() {
  const [state, action, pending] = useActionState<DarianImportState, FormData>(importDarian, undefined);
  const r = state?.result;
  const stat = (label: string, v: number, hint?: string) => (
    <div className="rounded-xl bg-bg p-3" title={hint}>
      <div className="text-xs text-muted">{label}</div>
      <b>{v}</b>
    </div>
  );
  return (
    <section className="card min-w-0 p-5">
      <form action={action} className="space-y-4">
        <div>
          <label className="label">Файл прайса Darian (.xlsx, как присылает поставщик)</label>
          <input
            type="file"
            name="file"
            required
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="w-full rounded-xl border border-dashed border-line-2 bg-bg p-4 text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-semibold file:text-accent-ink"
          />
        </div>
        <p className="text-xs text-muted">
          Листы LAPTOP, ALL IN ONE, MONITOR, ACCESSORIES читаются автоматически. Позиции с «.» вместо цены сохраняются, но на сайт не выходят.
          Товары, которые есть и у AGE, привязываются к той же карточке; сомнительные пары появятся ниже в «Проверьте совпадения».
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn-accent" disabled={pending}>{pending ? "Загружаем…" : "Загрузить прайс"}</button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="dry_run" value="1" /> Только проверить (не сохранять)
          </label>
        </div>
      </form>

      {state?.error ? <p className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">{state.error}</p> : null}
      {r ? (
        <div className="mt-5 space-y-3 border-t border-line pt-5">
          <p className={`text-sm ${r.dryRun ? "text-warn" : "text-ok"}`}>
            {r.dryRun ? `Проверка: в файле ${r.total} позиций, из них ${r.priced} с ценой. В базу ничего не записано.` : `Прайс «${r.filename}» загружен ✓`}
          </p>
          {!r.dryRun ? (
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {stat("Позиций в прайсе", r.total)}
              {stat("С ценой", r.priced)}
              {stat("Новых на сайте", r.added)}
              {stat("Привязано к товарам AGE и повторам", r.merged)}
              {stat("На проверку", r.review)}
              {stat("Обновлено позиций", r.updated)}
              {stat("Пропало из прайса", r.missing, "Помечены «нет в наличии», на сайте скрыты")}
              {stat("Без раздела (только в прайсе)", r.skipped, "Роутеры, жёсткие диски, подставки — на сайт не выкладываются")}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
