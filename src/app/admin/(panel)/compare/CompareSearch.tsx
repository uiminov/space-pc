"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { suggestOffers, type Suggestion } from "../../supplierActions";

type Picked = { key: string; title: string };

// Поиск товаров с подсказками: печатаете пару слов — ниже товары из всех прайсов, клик добавляет в сравнение.
// Enter без выбора — добавить сам текст запроса (сравнятся все найденные по нему варианты).
export function CompareSearch({ initial, showAll }: { initial: Picked[]; showAll: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked[]>(initial);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [all, setAll] = useState(showAll);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const n = ++seq.current;
    const t = setTimeout(async () => {
      // короткий запрос — подсказки очищаем (внутри таймера, не синхронно в эффекте)
      if (term.length < 2) {
        if (n === seq.current) setItems([]);
        return;
      }
      const res = await suggestOffers(term);
      if (n === seq.current) {
        setItems(res);
        setActive(0);
        setOpen(true);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const go = (list: Picked[], showAllNow = all) => {
    const params = new URLSearchParams();
    if (list.length) params.set("q", list.map((p) => p.key).join("\n"));
    if (showAllNow) params.set("stock", "0");
    router.push(`/admin/compare${params.size ? `?${params}` : ""}`);
  };
  const add = (p: Picked) => {
    const next = picked.some((x) => x.key === p.key) ? picked : [...picked, p];
    setPicked(next);
    setQ("");
    setItems([]);
    setOpen(false);
    go(next);
  };
  const remove = (key: string) => {
    const next = picked.filter((x) => x.key !== key);
    setPicked(next);
    go(next);
  };

  return (
    <div className="card mt-6 p-5">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const it = open ? items[active] : undefined;
              if (it) add({ key: it.key, title: it.title });
              else if (q.trim()) add({ key: q.trim(), title: `Все варианты: «${q.trim()}»` });
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Начните вводить модель: legion 5, 15-fc0196, g34wqc2, zenbook…"
          className="input text-base"
          autoFocus
        />
        {open && items.length ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-line-2 bg-surface p-1 shadow-2xl">
            {items.map((it, i) => (
              <li key={it.key}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add({ key: it.key, title: it.title })}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? "bg-surface-2" : ""}`}
                >
                  <span className="min-w-0 flex-1 text-sm">{it.title}</span>
                  <span className="flex shrink-0 gap-1">
                    {it.suppliers.map((s) => (
                      <span key={s} className="rounded bg-text/[0.07] px-1.5 py-0.5 text-[11px] font-semibold">{s}</span>
                    ))}
                  </span>
                  <span className="w-20 shrink-0 text-right text-sm font-semibold whitespace-nowrap">
                    {it.best != null ? `$${it.best}` : <span className="text-xs font-normal text-warn">нет</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {picked.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {picked.map((p) => (
            <span key={p.key} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line-2 bg-bg py-1 pr-1 pl-3 text-xs">
              <span className="truncate">{p.title}</span>
              <button type="button" onClick={() => remove(p.key)} className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted hover:bg-danger/10 hover:text-danger" aria-label="Убрать">
                ×
              </button>
            </span>
          ))}
          <button type="button" onClick={() => { setPicked([]); go([]); }} className="text-xs text-muted hover:text-text">очистить</button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">Выберите товар из подсказок — он добавится в сравнение. Можно добавить несколько: внизу будет итог закупки.</p>
      )}

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={all}
          onChange={(e) => {
            setAll(e.target.checked);
            go(picked, e.target.checked);
          }}
        />
        показывать и без цены / не в наличии
      </label>
    </div>
  );
}
