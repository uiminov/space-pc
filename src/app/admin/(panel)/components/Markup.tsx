"use client";

import { useActionState, useState, useTransition } from "react";
import { bulkMarkup, setComponentMarkup, type SaveState } from "../../actions";

// Наценка одного товара прямо в таблице: сохраняется при выходе из поля или по Enter
export function MarkupCell({ id, value, fallback }: { id: number; value: number | null; fallback: number }) {
  const [v, setV] = useState(value == null ? "" : String(value));
  const [saved, setSaved] = useState(value == null ? "" : String(value));
  const [state, setState] = useState<"" | "ok" | "err">("");
  const [pending, start] = useTransition();
  const save = () => {
    if (v.trim() === saved.trim()) return;
    start(async () => {
      const r = await setComponentMarkup(id, v);
      if (r?.error) setState("err");
      else {
        setSaved(v);
        setState("ok");
        setTimeout(() => setState(""), 1500);
      }
    });
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setState("");
        }}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        inputMode="decimal"
        placeholder={String(fallback)}
        title={v ? "Своя наценка товара" : `Общая наценка ${fallback}% — впишите число, чтобы задать свою`}
        className={`w-16 rounded-lg border bg-bg px-2 py-1 text-right text-sm outline-none focus:border-accent ${
          state === "err" ? "border-danger" : v ? "border-accent/60 font-semibold" : "border-line-2"
        }`}
      />
      <span className="w-4 text-xs text-muted">{pending ? "…" : state === "ok" ? <span className="text-ok">✓</span> : "%"}</span>
    </div>
  );
}

// Наценка сразу на все товары по текущему фильтру
export function BulkMarkup({ cat, brand, q, count, label }: { cat: string; brand: string; q: string; count: number; label: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(bulkMarkup, undefined);
  return (
    <form action={action} className="card mt-4 flex flex-wrap items-center gap-2 p-3 text-sm">
      <input type="hidden" name="cat" value={cat} />
      <input type="hidden" name="brand" value={brand} />
      <input type="hidden" name="q" value={q} />
      <span className="text-muted">
        Наценка для <b className="text-text">{label}</b> ({count} шт.):
      </span>
      <input name="markup" inputMode="decimal" placeholder="напр. 15" className="input w-24 py-1.5" />
      <span className="text-muted">%</span>
      <button className="btn-accent py-1.5" disabled={pending}>Применить</button>
      <button name="reset" value="1" className="btn-ghost py-1.5" disabled={pending}>Сбросить к общей</button>
      {state?.error ? <span className="text-danger">{state.error}</span> : null}
      {state?.ok ? <span className="text-ok">{state.ok} ✓</span> : null}
    </form>
  );
}
