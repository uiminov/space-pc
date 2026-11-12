"use client";

import { useActionState } from "react";
import { createOrder, type OrderState } from "@/app/(shop)/actions";
import { useI18n } from "@/lib/i18n/client";

export function OrderForm({
  hidden,
  submitLabel,
  disabled,
}: {
  hidden: Record<string, string>;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<OrderState, FormData>(createOrder, undefined);
  return (
    <form action={action} className="space-y-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div>
        <label className="label" htmlFor="o-name">{t.order.name}</label>
        <input id="o-name" name="name" required className="input" placeholder={t.order.namePh} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="o-phone">{t.order.phone}</label>
        <input id="o-phone" name="phone" required type="tel" className="input" placeholder="+998 __ ___ __ __" defaultValue="+998 " autoComplete="tel" />
      </div>
      <div>
        <label className="label" htmlFor="o-comment">{t.order.comment}</label>
        <textarea id="o-comment" name="comment" rows={2} className="input" placeholder={t.order.commentPh} />
      </div>
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button className="btn-accent w-full py-3 text-base" disabled={pending || disabled}>
        {pending ? t.order.sending : submitLabel ?? t.order.submit}
      </button>
      <p className="text-xs text-muted">{t.order.note}</p>
    </form>
  );
}
