"use client";

import { useActionState } from "react";
import { createQuote, type QuoteState } from "@/app/(shop)/actions";
import { useI18n } from "@/lib/i18n/client";

// Форма заявки компании на коммерческое предложение
export function QuoteForm({ segment = "" }: { segment?: string }) {
  const { t } = useI18n();
  const b = t.b2b;
  const [state, action, pending] = useActionState<QuoteState, FormData>(createQuote, undefined);
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="segment" value={segment} />
      <div>
        <label className="label" htmlFor="q-name">{b.contact}</label>
        <input id="q-name" name="name" required className="input" placeholder={b.contactPh} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="q-phone">{b.phone}</label>
        <input id="q-phone" name="phone" required type="tel" className="input" defaultValue="+998 " autoComplete="tel" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="q-comment">{b.comment}</label>
        <textarea id="q-comment" name="comment" rows={3} className="input" placeholder={b.commentPh} />
      </div>
      <div className="sm:col-span-2">
        {state?.error ? <p className="mb-3 text-sm text-danger">{state.error}</p> : null}
        <button className="btn-accent w-full py-3 text-base sm:w-auto sm:px-10" disabled={pending}>
          {pending ? b.sending : b.submit}
        </button>
        <p className="mt-3 text-xs text-muted">{b.note}</p>
      </div>
    </form>
  );
}
