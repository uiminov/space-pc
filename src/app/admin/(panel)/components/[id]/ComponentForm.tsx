"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { findImageIcecat, saveComponent, searchPriceItems, type SaveState } from "../../../actions";
import { CATEGORIES, SPEC_FIELDS } from "@/lib/catalog";
import { formatNumber, formatSum } from "@/lib/format";

type Data = {
  id: number;
  category: string;
  name: string;
  brand: string;
  price_code: string;
  manual_price: number | null;
  specs: Record<string, string>;
  image: string | null;
  active: boolean;
  supplier_name: string | null;
  supplier_price: number | null;
  cost: number | null;
  in_stock: boolean;
};

type Hit = Awaited<ReturnType<typeof searchPriceItems>>[number];

export function ComponentForm({ c, currency }: { c: Data | null; currency: string }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveComponent, undefined);
  const [category, setCategory] = useState(c?.category ?? "cpu");
  const [name, setName] = useState(c?.name ?? "");
  const [code, setCode] = useState(c?.price_code ?? "");
  const [picked, setPicked] = useState<Hit | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, startSearch] = useTransition();
  const [brand, setBrand] = useState(c?.brand ?? "");
  const [imageUrl, setImageUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [imgMsg, setImgMsg] = useState<string | null>(null);
  const [findingImg, startFindImg] = useTransition();
  const preview = imageUrl || (removeImage ? null : c?.image);

  useEffect(() => {
    if (q.trim().length < 2) return; // выпадающий список скрыт, пока запрос короче 2 символов
    const t = setTimeout(() => startSearch(async () => setHits(await searchPriceItems(q))), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <form action={action} className="mt-6 space-y-6">
      {c ? <input type="hidden" name="id" value={c.id} /> : null}

      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div>
            <label className="label">Категория</label>
            <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className="input">
              {CATEGORIES.map((x) => (
                <option key={x.key} value={x.key}>{x.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Название на сайте</label>
            <input name="name" required value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Бренд</label>
            <input name="brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="input" placeholder="MSI, Deepcool, AMD…" />
          </div>
          <label className="flex items-end gap-2 pb-3 text-sm">
            <input type="checkbox" name="active" defaultChecked={c?.active ?? true} /> Активна (доступна в сборках и конфигураторе)
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Привязка к прайсу AGE</h2>
        <div className="relative">
          <label className="label">Найти позицию в прайсе</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Например: 7800X3D или RTX 5070" />
          {q.trim().length >= 2 ? (
            <div className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-line-2 bg-surface-2 shadow-2xl">
              {searching && !hits.length ? <div className="p-3 text-sm text-muted">Ищем…</div> : null}
              {!searching && !hits.length ? <div className="p-3 text-sm text-muted">Ничего не найдено</div> : null}
              {hits.map((h) => (
                <button
                  type="button"
                  key={h.code}
                  onClick={() => {
                    setCode(h.code);
                    setPicked(h);
                    if (!name) setName(h.name);
                    setQ("");
                  }}
                  className="flex w-full items-center gap-3 border-b border-line px-3 py-2 text-left text-sm last:border-0 hover:bg-surface"
                >
                  <span className="w-28 shrink-0 truncate font-mono text-xs text-muted">{h.code}</span>
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  <span className="shrink-0">{formatNumber(h.price)} {currency}</span>
                  {!h.in_stock ? <span className="shrink-0 text-xs text-warn">нет</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Код позиции в прайсе</label>
            <input name="price_code" value={code} onChange={(e) => { setCode(e.target.value); setPicked(null); }} className="input font-mono" />
          </div>
          <div>
            <label className="label">Ручная цена, сум (если нет в прайсе)</label>
            <input name="manual_price" defaultValue={c?.manual_price ?? ""} inputMode="numeric" className="input" />
          </div>
        </div>
        <div className="rounded-xl bg-bg p-3 text-sm">
          {picked ? (
            <span>
              Будет привязано: <b>{picked.name}</b> — {formatNumber(picked.price)} {currency}
            </span>
          ) : c?.supplier_name ? (
            <span>
              В прайсе: <b>{c.supplier_name}</b> — {formatNumber(c.supplier_price)} {currency} → себестоимость{" "}
              <b>{formatSum(c.cost)}</b> · {c.in_stock ? <span className="text-ok">в наличии</span> : <span className="text-warn">нет в наличии</span>}
            </span>
          ) : code ? (
            <span className="text-warn">Код «{code}» пока не найден в прайсе. Загрузите прайс или проверьте код.</span>
          ) : (
            <span className="text-muted">Не привязано к прайсу{c?.manual_price ? ` — используется ручная цена ${formatSum(c.manual_price)}` : ""}.</span>
          )}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">Фото</h2>
        {removeImage ? <input type="hidden" name="remove_image" value="1" /> : null}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white sm:w-48">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-contain" />
            ) : (
              <span className="text-xs text-neutral-400">нет фото</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <label className="label">Загрузить файл</label>
              <input type="file" name="image_file" accept="image/jpeg,image/png,image/webp,image/avif" className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text" />
            </div>
            <div>
              <label className="label">…или ссылка на фото (скачается к нам на сервер)</label>
              <input name="image_url" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setRemoveImage(false); }} className="input" placeholder="https://…" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn-ghost py-2"
                disabled={findingImg}
                onClick={() =>
                  startFindImg(async () => {
                    setImgMsg(null);
                    const r = await findImageIcecat(brand, code);
                    if (r.url) {
                      setImageUrl(r.url);
                      setRemoveImage(false);
                      setImgMsg(`Найдено: ${r.title ?? r.url}. Нажмите «Сохранить».`);
                    } else setImgMsg(r.error ?? "Не найдено");
                  })
                }
              >
                {findingImg ? "Ищем…" : "Найти фото в Icecat"}
              </button>
              {c?.image && !removeImage ? (
                <button type="button" className="text-sm text-danger" onClick={() => { setRemoveImage(true); setImageUrl(""); }}>
                  Удалить фото
                </button>
              ) : null}
            </div>
            {imgMsg ? <p className="text-xs text-muted">{imgMsg}</p> : null}
          </div>
        </div>
      </section>

      {SPEC_FIELDS[category]?.length ? (
        <section className="card space-y-4 p-5">
          <div>
            <h2 className="font-semibold">Характеристики</h2>
            <p className="text-xs text-muted">Нужны для проверки совместимости в конфигураторе и отображения на сайте</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {SPEC_FIELDS[category].map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input name={`spec_${f.key}`} defaultValue={c?.specs[f.key] ?? ""} placeholder={f.placeholder} className="input" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex items-center gap-4">
        <button className="btn-accent" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</button>
        {state?.error ? <span className="text-sm text-danger">{state.error}</span> : null}
        {state?.ok ? <span className="text-sm text-ok">{state.ok} ✓</span> : null}
      </div>
    </form>
  );
}
