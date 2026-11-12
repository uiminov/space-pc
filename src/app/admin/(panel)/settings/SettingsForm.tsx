"use client";

import { useActionState, useTransition } from "react";
import { saveSettings, testTelegram, updateRateFromCbu, type SaveState } from "../../actions";
import type { Settings } from "@/lib/settings";

function Field({ name, label, s, hint, type = "text" }: { name: keyof Settings; label: string; s: Settings; hint?: string; type?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={s[name]} className="input" />
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function SettingsForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveSettings, undefined);
  const [testing, startTest] = useTransition();
  const [rateState, rateAction, ratePending] = useActionState<SaveState, FormData>(updateRateFromCbu, undefined);
  return (
    <form action={action} className="mt-6 space-y-6">
      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Ценообразование</h2>
          <p className="text-xs text-muted">Цена сборки = (сумма по прайсу × курс) × (1 + наценка%) + сборка, округление вверх</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="price_currency">Валюта цен в прайсе AGE</label>
            <select id="price_currency" name="price_currency" defaultValue={s.price_currency} className="input">
              <option value="USD">USD — пересчитывать по курсу</option>
              <option value="UZS">UZS — цены уже в сумах</option>
            </select>
          </div>
          <div>
            <Field name="usd_rate" label="Курс USD → сум" s={s} hint={s.usd_rate_date ? `Курс ЦБ на ${s.usd_rate_date}` : "Цены пересчитываются сразу после сохранения"} />
            <input type="hidden" name="usd_rate_auto" value="0" />
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="usd_rate_auto" value="1" defaultChecked={s.usd_rate_auto === "1"} />
              Брать курс ЦБ Узбекистана автоматически (обновление каждые 3 часа)
            </label>
            <button type="submit" formAction={rateAction} className="btn-ghost mt-2 py-2" disabled={ratePending}>
              {ratePending ? "Запрашиваем…" : "Обновить курс ЦБ сейчас"}
            </button>
            {rateState?.ok ? <p className="mt-1 text-xs text-ok">{rateState.ok}</p> : null}
            {rateState?.error ? <p className="mt-1 text-xs text-danger">{rateState.error}</p> : null}
          </div>
          <Field name="markup_percent" label="Наценка в сборках, %" s={s} hint="Можно переопределить в каждой сборке" />
          <Field name="parts_markup_percent" label="Наценка при продаже по отдельности, %" s={s} hint="Пусто — такая же, как в сборках" />
          <Field name="assembly_fee" label="Сборка и тестирование, сум" s={s} />
          <Field name="round_to" label="Округлять цену до, сум" s={s} hint="Например 10000 → 12 345 678 станет 12 350 000" />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Рассрочка</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="installment_months" label="Срок, месяцев" s={s} />
          <Field name="installment_markup_percent" label="Наценка рассрочки, %" s={s} hint="Для расчёта «от … сум/мес»" />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Магазин и контакты</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="shop_name" label="Название" s={s} />
          <Field name="phone" label="Телефон" s={s} />
          <Field name="telegram" label="Telegram (username)" s={s} />
          <Field name="instagram" label="Instagram" s={s} />
          <Field name="address" label="Адрес" s={s} />
          <Field name="work_hours" label="Часы работы" s={s} />
          <Field name="address_uz" label="Manzil (узб.)" s={s} />
          <Field name="work_hours_uz" label="Ish vaqti (узб.)" s={s} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Уведомления о заказах в Telegram</h2>
          <p className="text-xs text-muted">
            Создайте бота через @BotFather, добавьте его в чат менеджеров и укажите ID чата (можно узнать через @userinfobot).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="tg_bot_token" label="Токен бота" s={s} type="password" />
          <Field name="tg_chat_id" label="ID чата" s={s} />
        </div>
        <button type="button" className="btn-ghost" disabled={testing} onClick={() => startTest(() => testTelegram())}>
          {testing ? "Отправляем…" : "Отправить тестовое сообщение"}
        </button>
      </section>

      <div className="flex items-center gap-4">
        <button className="btn-accent" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</button>
        {state?.ok ? <span className="text-sm text-ok">{state.ok} ✓</span> : null}
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
      </div>
    </form>
  );
}
