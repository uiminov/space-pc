"use client";

import { useActionState } from "react";
import { saveBanner, type SaveState } from "../../actions";
import type { Settings } from "@/lib/settings";

function Pair({ name, label, s, rows, ph }: { name: string; label: string; s: Settings; rows?: number; ph?: [string, string] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {(["uz", "ru"] as const).map((l) => {
        const key = `${name}_${l}` as keyof Settings;
        const props = { id: key, name: key, defaultValue: s[key], className: "input", placeholder: ph?.[l === "uz" ? 0 : 1] };
        return (
          <div key={l}>
            <label className="label" htmlFor={key}>{label} · {l === "uz" ? "O‘zbekcha" : "Русский"}</label>
            {rows ? <textarea rows={rows} {...props} /> : <input {...props} />}
          </div>
        );
      })}
    </div>
  );
}

export function BannerForm({ s }: { s: Settings }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveBanner, undefined);
  return (
    <form action={action} className="mt-6 space-y-6">
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Баннер-объявление</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="banner_on" defaultChecked={s.banner_on === "1"} /> Показывать на сайте
          </label>
        </div>
        <Pair name="banner_title" label="Заголовок" s={s} ph={["Yangi yil chegirmalari", "Новогодние скидки"]} />
        <Pair name="banner_text" label="Текст" s={s} rows={2} ph={["31-dekabrgacha barcha yig'malarga −5%", "До 31 декабря −5% на все сборки"]} />
        <Pair name="banner_btn" label="Текст кнопки" s={s} ph={["Batafsil", "Подробнее"]} />
        <div>
          <label className="label" htmlFor="banner_link">Ссылка кнопки</label>
          <input id="banner_link" name="banner_link" defaultValue={s.banner_link} className="input" placeholder="/catalog  или  https://t.me/spacepc" />
          <p className="mt-1 text-xs text-muted">Пусто — баннер без кнопки</p>
        </div>
        <div>
          <label className="label" htmlFor="banner_image">Картинка (необязательно)</label>
          {s.banner_image ? (
            <div className="mb-2 flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.banner_image} alt="" className="h-16 w-28 rounded-lg object-cover" />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name="remove_image" value="1" /> Убрать картинку
              </label>
            </div>
          ) : null}
          <input id="banner_image" name="banner_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="text-sm" />
          <p className="mt-1 text-xs text-muted">Горизонтальная, примерно 1600×600. JPG, PNG или WEBP до 8 МБ.</p>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-semibold">Текст первого экрана</h2>
          <p className="text-xs text-muted">Под большим заголовком на главной. Пусто — стандартный текст.</p>
        </div>
        <Pair name="hero_sub" label="Текст" s={s} rows={3} />
      </section>

      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm text-ok">{state.ok} ✓</p> : null}
      <button className="btn-accent px-8" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</button>
    </form>
  );
}
