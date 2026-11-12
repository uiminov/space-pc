"use client";

import { useActionState, useMemo, useState } from "react";
import { saveBuild, type SaveState } from "../../../actions";
import { CATEGORIES, PURPOSES } from "@/lib/catalog";
import { formatSum } from "@/lib/format";

export type EditorComponent = {
  id: number;
  category: string;
  name: string;
  cost: number | null;
  inStock: boolean;
  code: string | null;
};

type BuildData = {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  purpose: string;
  image: string | null;
  markup_percent: number | null;
  assembly_fee: number | null;
  extra_price: number;
  fps: string;
  name_uz: string;
  tagline_uz: string;
  description_uz: string;
  fps_uz: string;
  featured: boolean;
  active: boolean;
  sort: number;
  items: { component_id: number; qty: number }[];
  problems: string[];
};

const MAIN = ["cpu", "cooler", "mb", "ram", "gpu", "ssd", "psu", "case"];

export function BuildEditor({
  build,
  components,
  defaults,
}: {
  build: BuildData | null;
  components: EditorComponent[];
  defaults: { markup: number; assembly: number; roundTo: number };
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveBuild, undefined);
  const [items, setItems] = useState<{ key: number; category: string; component_id: number; qty: number }[]>(() => {
    if (build?.items.length) {
      return build.items.map((i, idx) => ({
        key: idx,
        category: components.find((c) => c.id === i.component_id)?.category ?? "other",
        component_id: i.component_id,
        qty: i.qty,
      }));
    }
    return MAIN.map((c, idx) => ({ key: idx, category: c, component_id: 0, qty: 1 }));
  });
  const [markup, setMarkup] = useState(build?.markup_percent?.toString() ?? "");
  const [assembly, setAssembly] = useState(build?.assembly_fee?.toString() ?? "");
  const [extra, setExtra] = useState(build?.extra_price ? String(build.extra_price) : "");
  const [removeImage, setRemoveImage] = useState(false);

  const byCat = useMemo(() => {
    const m: Record<string, EditorComponent[]> = {};
    for (const c of components) (m[c.category] ||= []).push(c);
    return m;
  }, [components]);

  const calc = useMemo(() => {
    let cost = 0;
    let ok = true;
    for (const it of items) {
      if (!it.component_id) continue;
      const c = components.find((x) => x.id === it.component_id);
      if (!c || c.cost == null) ok = false;
      else cost += c.cost * it.qty;
    }
    const m = markup === "" ? defaults.markup : parseFloat(markup) || 0;
    const a = assembly === "" ? defaults.assembly : parseFloat(assembly) || 0;
    const e = parseFloat(extra) || 0;
    const price = ok ? Math.ceil((cost * (1 + m / 100) + a + e) / defaults.roundTo) * defaults.roundTo : null;
    return { cost, price, ok };
  }, [items, components, markup, assembly, extra, defaults]);

  const nextKey = () => Math.max(0, ...items.map((i) => i.key)) + 1;
  const update = (key: number, patch: Partial<(typeof items)[number]>) =>
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <form action={action} className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      {build ? <input type="hidden" name="id" value={build.id} /> : null}
      <input type="hidden" name="items" value={JSON.stringify(items.filter((i) => i.component_id).map(({ component_id, qty }) => ({ component_id, qty })))} />
      {removeImage ? <input type="hidden" name="remove_image" value="1" /> : null}

      <div className="min-w-0 space-y-6">
        <section className="card space-y-4 p-5">
          <h2 className="font-semibold">Основное</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Название</label>
              <input name="name" required defaultValue={build?.name} className="input" placeholder="Например: Оптима" />
            </div>
            <div>
              <label className="label">Адрес страницы (slug)</label>
              <input name="slug" defaultValue={build?.slug} className="input" placeholder="создастся из названия" />
            </div>
          </div>
          <div>
            <label className="label">Подзаголовок</label>
            <input name="tagline" defaultValue={build?.tagline} className="input" placeholder="Коротко, для карточки" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Назначение</label>
              <select name="purpose" defaultValue={build?.purpose ?? "gaming"} className="input">
                {PURPOSES.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Порядок</label>
              <input name="sort" type="number" defaultValue={build?.sort ?? 100} className="input" />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" defaultChecked={build?.active ?? true} /> Показывать на сайте
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="featured" defaultChecked={build?.featured} /> Хит (на главной)
              </label>
            </div>
          </div>
          <div>
            <label className="label">FPS в играх (через запятую)</label>
            <input name="fps" defaultValue={build?.fps} className="input" placeholder="CS2 — 400+ FPS, Cyberpunk 2077 — 90 FPS (1440p)" />
          </div>
          <div>
            <label className="label">Описание</label>
            <textarea name="description" rows={4} defaultValue={build?.description} className="input" />
          </div>
          <fieldset className="space-y-4 rounded-xl border border-line p-4">
            <legend className="px-2 text-sm font-semibold">O‘zbekcha (основной язык сайта)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Nomi</label>
                <input name="name_uz" defaultValue={build?.name_uz} className="input" placeholder="Если пусто — как по-русски" />
              </div>
              <div>
                <label className="label">Qisqacha</label>
                <input name="tagline_uz" defaultValue={build?.tagline_uz} className="input" />
              </div>
            </div>
            <div>
              <label className="label">FPS (o‘yinlarda)</label>
              <input name="fps_uz" defaultValue={build?.fps_uz} className="input" />
            </div>
            <div>
              <label className="label">Tavsif</label>
              <textarea name="description_uz" rows={4} defaultValue={build?.description_uz} className="input" />
            </div>
          </fieldset>
          <div>
            <label className="label">Фото</label>
            <div className="flex items-center gap-4">
              {build?.image && !removeImage ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={build.image} alt="" className="h-16 w-24 rounded-lg object-cover" />
                  <button type="button" onClick={() => setRemoveImage(true)} className="text-sm text-danger">Удалить фото</button>
                </>
              ) : null}
              <input type="file" name="image" accept="image/jpeg,image/png,image/webp,image/avif" className="text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-text" />
            </div>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Комплектующие</h2>
            <button
              type="button"
              className="btn-ghost py-1.5"
              onClick={() => setItems((xs) => [...xs, { key: nextKey(), category: "ssd", component_id: 0, qty: 1 }])}
            >
              + Добавить
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {items.map((it) => {
              const c = components.find((x) => x.id === it.component_id);
              return (
                <div key={it.key} className="grid grid-cols-[minmax(0,1fr)_56px_24px] items-center gap-2 border-b border-line pb-2 sm:grid-cols-[130px_minmax(0,1fr)_60px_110px_28px] sm:border-0 sm:pb-0">
                  <select
                    value={it.category}
                    onChange={(e) => update(it.key, { category: e.target.value, component_id: 0 })}
                    className="input col-span-3 px-2 py-2 sm:col-span-1"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.key} value={cat.key}>{cat.label}</option>
                    ))}
                  </select>
                  <select
                    value={it.component_id}
                    onChange={(e) => update(it.key, { component_id: Number(e.target.value) })}
                    className="input px-2 py-2"
                  >
                    <option value={0}>— не выбрано —</option>
                    {(byCat[it.category] ?? []).map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.cost == null ? " (нет цены)" : !o.inStock ? " (нет в наличии)" : ""}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={it.qty}
                    onChange={(e) => update(it.key, { qty: Number(e.target.value) || 1 })}
                    className="input px-2 py-2"
                  />
                  <div className={`hidden text-right text-xs whitespace-nowrap sm:block ${c && c.cost == null ? "text-danger" : c && !c.inStock ? "text-warn" : "text-muted"}`}>
                    {c ? (c.cost != null ? formatSum(c.cost * it.qty) : "нет цены") : ""}
                  </div>
                  <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} className="text-muted hover:text-danger" title="Убрать">
                    ×
                  </button>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Показана себестоимость по прайсу. Нет нужной детали? Добавьте её в разделе «Комплектующие».</p>
        </section>
      </div>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <div className="card space-y-4 p-5">
          <h2 className="font-semibold">Цена</h2>
          <div>
            <label className="label">Наценка, % (пусто = {defaults.markup}%)</label>
            <input name="markup_percent" value={markup} onChange={(e) => setMarkup(e.target.value)} className="input" inputMode="decimal" />
          </div>
          <div>
            <label className="label">Сборка, сум (пусто = {formatSum(defaults.assembly)})</label>
            <input name="assembly_fee" value={assembly} onChange={(e) => setAssembly(e.target.value)} className="input" inputMode="numeric" />
          </div>
          <div>
            <label className="label">Доп. сумма, сум (Windows, Wi‑Fi…)</label>
            <input name="extra_price" value={extra} onChange={(e) => setExtra(e.target.value)} className="input" inputMode="numeric" placeholder="0" />
          </div>
          <div className="space-y-1 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-muted">
              <span>Себестоимость</span>
              <span>{formatSum(calc.cost)}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Маржа</span>
              <span className="text-ok">{calc.price != null ? formatSum(calc.price - calc.cost) : "—"}</span>
            </div>
            <div className="flex items-baseline justify-between pt-2">
              <span>Цена на сайте</span>
              <span className="font-display text-xl font-semibold">{calc.price != null ? formatSum(calc.price) : "—"}</span>
            </div>
            {!calc.ok ? <p className="text-xs text-danger">У части комплектующих нет цены — сборка покажется как «Цена по запросу».</p> : null}
          </div>
          {build?.problems.length ? (
            <ul className="space-y-1 rounded-xl border border-warn/30 bg-warn/5 p-3 text-xs text-warn">
              {build.problems.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          ) : null}
          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
          {state?.ok ? <p className="text-sm text-ok">{state.ok} ✓</p> : null}
          <button className="btn-accent w-full" disabled={pending}>{pending ? "Сохраняем…" : "Сохранить"}</button>
        </div>
      </aside>
    </form>
  );
}
