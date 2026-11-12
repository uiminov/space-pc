"use client";

import { useEffect, useMemo, useState } from "react";
import { REQUIRED_CATEGORIES } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n/client";
import { locSpec, type Dict } from "@/lib/i18n/dict";
import { OrderForm } from "@/components/OrderForm";
import { ProductImage } from "@/components/ProductImage";
import { CaseScene } from "./CaseScene";
import { PhotoScene } from "./PhotoScene";
import { MoneyText } from "@/components/MoneyText";
import { adviseCategory, cpuHasCooler, recommendedPsu as calcPsu, type Advice } from "./advisor";

export type ConfOption = {
  id: number;
  category: string;
  name: string;
  specs: Record<string, string>;
  image: string | null;
  price: number;
  inStock: boolean;
};

const STORE_KEY = "spacepc-configurator-v1";
const CONF_CATS = ["cpu", "cooler", "mb", "ram", "gpu", "ssd", "hdd", "psu", "case"];

const norm = (s?: string) => (s ?? "").trim().toLowerCase().replace(/\s+/g, "");
const tokens = (s?: string) => (s ?? "").split(/[,/;]/).map(norm).filter(Boolean);
const r1k = (n: number) => Math.ceil(n / 1000) * 1000;
const int = (s?: string) => parseInt((s ?? "").replace(/\D/g, "")) || 0;

function caseFits(caseFF?: string, mbFF?: string) {
  if (!caseFF || !mbFF) return true;
  const list = tokens(caseFF);
  const mb = norm(mbFF);
  if (list.includes(mb)) return true;
  // корпус под бо́льший форм-фактор вмещает меньший: ITX < mATX < ATX < E-ATX
  const size = (x: string) =>
    x.includes("itx") ? 0 : x.startsWith("e") ? 3 : x.startsWith("m") || x.includes("micro") ? 1 : 2;
  return list.some((c) => size(c) >= size(mb));
}

type Sel = Record<string, number | undefined>;

// Какой тип памяти поддерживает платформа процессора (LGA1700 — оба, решает плата)
function cpuRamType(cpu?: ConfOption): string | null {
  const sock = norm(cpu?.specs.socket);
  if (sock === "am5" || sock === "lga1851") return "DDR5";
  if (sock === "am4") return "DDR4";
  return null;
}

// С какими выбранными деталями проверяется совместимость каждой категории
const DEPS: Record<string, string[]> = { cpu: ["mb", "ram"], mb: ["cpu", "ram", "case"], ram: ["mb", "cpu"], case: ["mb"] };

function incompat(o: ConfOption, sel: Record<string, ConfOption | undefined>, t: Dict): string | null {
  const x = t.conf.x;
  const cpu = sel.cpu, mb = sel.mb, ram = sel.ram, cs = sel.case;
  switch (o.category) {
    case "cpu": {
      if (mb && o.specs.socket && mb.specs.socket && norm(o.specs.socket) !== norm(mb.specs.socket)) return x.socketMb(o.specs.socket, mb.specs.socket);
      const need = cpuRamType(o);
      if (ram && need && ram.specs.ram_type && norm(ram.specs.ram_type) !== norm(need)) return x.ramCpu(need, ram.specs.ram_type);
      break;
    }
    case "mb":
      if (cpu && o.specs.socket && cpu.specs.socket && norm(o.specs.socket) !== norm(cpu.specs.socket)) return x.socketCpu(o.specs.socket, cpu.specs.socket);
      if (ram && o.specs.ram_type && ram.specs.ram_type && norm(o.specs.ram_type) !== norm(ram.specs.ram_type)) return x.ramMb(o.specs.ram_type, ram.specs.ram_type);
      if (cs && !caseFits(cs.specs.form_factor, o.specs.form_factor)) return x.ffCase(o.specs.form_factor);
      break;
    case "ram": {
      if (mb && o.specs.ram_type && mb.specs.ram_type && norm(o.specs.ram_type) !== norm(mb.specs.ram_type)) return x.mbSupports(mb.specs.ram_type);
      const need = cpuRamType(cpu);
      if (need && o.specs.ram_type && norm(o.specs.ram_type) !== norm(need)) return x.cpuOnly(cpu!.specs.socket, need);
      break;
    }
    case "case":
      if (mb && !caseFits(o.specs.form_factor, mb.specs.form_factor)) return x.caseNo(mb.specs.form_factor);
      break;
  }
  return null;
}

export function Configurator({
  options,
  initial,
  assembly,
  roundTo,
  scene = "draw",
}: {
  options: ConfOption[];
  initial: Sel;
  assembly: number;
  roundTo: number;
  scene?: "draw" | "photo";
}) {
  const { t, lang } = useI18n();
  const money = (n: number) => t.money(n);
  const catLabel = (k: string) => t.cat[k] ?? k;
  const [sel, setSel] = useState<Sel>(initial);
  const [query, setQuery] = useState("");
  const [showIncompat, setShowIncompat] = useState(false);
  // на телефоне список без внутренней прокрутки: показываем первые N, дальше — кнопкой
  const [limit, setLimit] = useState(12);

  const byCat = useMemo(() => {
    const m: Record<string, ConfOption[]> = {};
    for (const o of options) (m[o.category] ||= []).push(o);
    for (const k in m) m[k].sort((a, b) => a.price - b.price);
    return m;
  }, [options]);

  const chosen = useMemo(() => {
    const m: Record<string, ConfOption | undefined> = {};
    for (const [k, id] of Object.entries(sel)) m[k] = options.find((o) => o.id === id);
    return m;
  }, [sel, options]);

  const parts = CONF_CATS.map((c) => chosen[c]).filter(Boolean) as ConfOption[];
  const sum = parts.reduce((a, p) => a + r1k(p.price), 0);
  const total = parts.length ? Math.ceil((sum + assembly) / roundTo) * roundTo : 0;

  const recommendedPsu = calcPsu(chosen);

  // Советы: что взять к уже выбранному (по порядку сборки)
  const compatible = (o: ConfOption) => !incompat(o, chosen, t);
  const advice = (cat: string) => adviseCategory(cat, chosen, options, compatible, t);
  const hasCpuOrGpu = !!(chosen.cpu || chosen.gpu);
  const order = ["mb", "ram", "gpu", "ssd", "psu", "case", "cooler"].filter((c) => !(c === "cooler" && cpuHasCooler(chosen.cpu)));
  const nextAdvice: Advice[] = hasCpuOrGpu
    ? order.filter((c) => !chosen[c] && byCat[c]?.length).map(advice).filter((a): a is Advice => !!a).slice(0, 2)
    : [];
  const requiredDone = REQUIRED_CATEGORIES.every((c) => chosen[c]);
  const extraAdvice: Advice[] =
    requiredDone && nextAdvice.length === 0 ? ["hdd", "cooler"].filter((c) => !chosen[c] && byCat[c]?.length && !(c === "cooler" && cpuHasCooler(chosen.cpu))).map(advice).filter((a): a is Advice => !!a) : [];

  const issues: string[] = [];
  const missing = REQUIRED_CATEGORIES.filter((c) => !chosen[c]);
  for (const p of parts) {
    const why = incompat(p, chosen, t);
    if (why) issues.push(`${catLabel(p.category)}: ${why}`);
  }
  if (chosen.psu && recommendedPsu && int(chosen.psu.specs.wattage) && int(chosen.psu.specs.wattage) < recommendedPsu)
    issues.push(t.conf.psuWeak(recommendedPsu));
  if (chosen.cpu && !chosen.gpu && !/^(да|yes|есть)/i.test(chosen.cpu.specs.igpu || ""))
    issues.push(t.conf.noGpu);
  const ready = missing.length === 0 && issues.length === 0;

  // Шаги мастера: категории с товарами + итог
  const steps = [...CONF_CATS.filter((c) => byCat[c]?.length), "summary"];
  const [step, setStep] = useState(() => (Object.keys(initial).length ? steps.length - 1 : 0));
  // Шаги, которые покупатель уже прошёл (выбрал деталь или нажал «Далее/Пропустить»).
  // Когда он возвращается поменять одну деталь, после выбора мы не ведём его по всем шагам заново,
  // а сразу возвращаем к итогу (или к детали, которая из-за замены стала несовместимой).
  const [seen, setSeen] = useState<string[]>(() => (Object.keys(initial).length ? steps : []));
  const cat = steps[step];
  const isSummary = cat === "summary";
  // после выбора детали: даём досмотреть, как она встаёт в корпус, и переходим дальше
  const [advance, setAdvance] = useState(0);
  // порядок списка: по рекомендации (вокруг подходящей цены), дешёвые или дорогие сначала
  const [sort, setSort] = useState<"rec" | "asc" | "desc">("rec");

  // Сборка не теряется: выбор хранится в браузере и возвращается, если покупатель
  // случайно ушёл со страницы (нажал на товар, меню, «назад») и вернулся.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      if (!Object.keys(initial).length) {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null") as { sel?: Sel; step?: number; seen?: string[] } | null;
        const ids = new Set(options.map((o) => o.id));
        const keep = Object.fromEntries(Object.entries(saved?.sel ?? {}).filter(([, id]) => id && ids.has(id)));
        if (Object.keys(keep).length) {
          const at = Math.max(0, Math.min(steps.length - 1, saved?.step ?? 0));
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSel(keep);
          setStep(at);
          setSeen(saved?.seen ?? [...steps.slice(0, at), ...Object.keys(keep)]);
        }
      }
    } catch {}
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ sel, step, seen }));
    } catch {}
  }, [sel, step, seen, restored]);

  const resetAll = () => {
    setSel({});
    setAdvance(0);
    setStep(0);
    setSeen([]);
    setQuery("");
    setLimit(12);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  };

  const go = (i: number) => {
    setAdvance(0);
    setStep(Math.max(0, Math.min(steps.length - 1, i)));
    setQuery("");
    setLimit(12);
    setShowIncompat(false);
    toTop();
  };

  // на телефоне поднимаемся к корпусу: видно, как деталь встаёт на место, и начало следующего шага
  function toTop() {
    if (typeof window === "undefined") return;
    const el = document.getElementById(window.innerWidth >= 1024 ? "conf-panel" : "conf-top");
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const markSeen = (c: string) => setSeen((s) => (s.includes(c) ? s : [...s, c]));

  // Куда идти после выбора детали или «Далее»:
  // 1) к уже выбранной детали, которая после замены стала несовместимой (сменили сокет — к плате);
  // 2) к следующему шагу, который покупатель ещё не проходил;
  // 3) если всё пройдено — к итогу, а не по всем шагам заново.
  const nextTarget = (from: number, done: string[] = seen) => {
    const broken = steps.findIndex((c, i) => i !== from && chosen[c] && incompat(chosen[c]!, chosen, t));
    if (broken >= 0) return broken;
    const open = (c: string, i: number) => i !== from && c !== "summary" && !chosen[c] && !done.includes(c);
    const fwd = steps.findIndex((c, i) => i > from && open(c, i));
    if (fwd >= 0) return fwd;
    const back = steps.findIndex((c, i) => i < from && open(c, i));
    if (back >= 0) return back;
    return steps.length - 1;
  };

  const next = () => {
    markSeen(cat);
    go(nextTarget(step, [...seen, cat]));
  };

  // сообщение после автоматической замены несовместимых деталей
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  const pick = (c: string, id: number | undefined) => {
    if (id && sel[c] === id) return; // уже выбрана — ничего не меняем
    const o = id ? options.find((x) => x.id === id) : undefined;
    // деталь не подходит к уже выбранным — убираем те, что с ней конфликтуют
    const drop = o ? (DEPS[c] ?? []).filter((d) => chosen[d] && incompat(chosen[d]!, { ...chosen, [c]: o }, t)) : [];
    if (drop.length) {
      setSel((s) => {
        const n = { ...s, [c]: id };
        for (const d of drop) delete n[d];
        return n;
      });
      setNotice(t.conf.replaced(drop.map((d) => catLabel(d).toLowerCase()).join(", ")));
      setShowIncompat(false);
      return; // остаёмся на шаге, чтобы было видно сообщение
    }
    setSel((s) => ({ ...s, [c]: id }));
    if (id) markSeen(c);
    if (id && c === cat) {
      toTop();
      setAdvance((n) => n + 1);
    }
  };

  useEffect(() => {
    if (!advance) return;
    const id = setTimeout(() => go(nextTarget(step)), 700);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advance]);

  const has = Object.fromEntries(CONF_CATS.map((c) => [c, !!chosen[c]]));

  // метка подсказки: цвет только в точке/короткой полоске, карточки остаются нейтральными
  // («Оптимально» — акцент, «Дешевле» — зелёный, «С запасом» — синий)
  const TAG_DOT = { best: "bg-accent", cheaper: "bg-ok", better: "bg-info" } as const;

  const optionRow = (o: ConfOption, c: string, tagOf: Map<number, Advice["picks"][number]["tag"]>) => {
    const why = incompat(o, chosen, t);
    const active = chosen[c]?.id === o.id;
    return (
      <button
        key={o.id}
        type="button"
        onClick={() => pick(c, o.id)}
        title={why ? `${t.conf.incompat(why)} — ${t.conf.tapToSwap}` : undefined}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-2 py-2 text-left transition-colors sm:gap-3 sm:px-3 sm:py-2.5 ${
          active ? "border-accent bg-accent/5" : "border-transparent hover:bg-surface-2"
        } ${why ? "opacity-60 hover:opacity-100" : ""}`}
      >
        <ProductImage src={o.image} category={o.category} className={`h-12 w-12 rounded-md ${active ? "ring-2 ring-accent" : ""}`} pad="p-0.5" iconClass="h-7 w-7" sizes="48px" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block text-[13px] leading-snug sm:text-sm">
            {o.name}
            {tagOf.get(o.id) ? (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-text/[0.07] px-1.5 py-0.5 align-middle text-[10px] font-semibold">
                <span className={`h-1.5 w-1.5 rounded-full ${TAG_DOT[tagOf.get(o.id)!]}`} />
                {t.conf.tag[tagOf.get(o.id)!]}
              </span>
            ) : null}
          </span>
          <span className="line-clamp-1 block text-xs text-muted">
            {why ? <span className="text-warn">{t.conf.incompat(why)} · {t.conf.tapToSwap}</span> : Object.entries(o.specs).filter(([k, v]) => v && k !== "igpu").map(([, v]) => locSpec(v, lang)).join(" · ")}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[13px] font-semibold whitespace-nowrap sm:text-sm">{money(r1k(o.price))}</span>
          {!o.inStock ? <span className="block text-xs text-warn">{t.conf.onOrder}</span> : null}
        </span>
      </button>
    );
  };

  // Панель текущего шага: подсказки, поиск и список вариантов
  const stepPanel = () => {
    const cur = chosen[cat];
    const required = REQUIRED_CATEGORIES.includes(cat as never);
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const all = byCat[cat].filter((o) => words.every((w) => o.name.toLowerCase().includes(w)));
    const list = all.filter((o) => showIncompat || !incompat(o, chosen, t) || cur?.id === o.id);
    const hidden = all.length - list.length;
    // выбранные детали, из-за которых часть вариантов скрыта
    const blockers = (DEPS[cat] ?? []).filter((d) => chosen[d] && all.some((o) => incompat(o, chosen, t)));
    const adv = hasCpuOrGpu && cat !== "cpu" ? advice(cat) : null;
    const tagOf = new Map(adv?.picks.map((p) => [p.opt.id, p.tag]) ?? []);
    // «По рекомендации»: сначала наши советы, затем варианты, ближайшие по цене к оптимальному
    const best = adv?.picks.find((p) => p.tag === "best") ?? adv?.picks[0];
    const rank = (o: ConfOption) => {
      const i = adv?.picks.findIndex((p) => p.opt.id === o.id) ?? -1;
      return i >= 0 ? i - 10 : 0;
    };
    const sorted =
      sort === "asc"
        ? list
        : sort === "desc"
          ? [...list].reverse()
          : best
            ? [...list].sort((a, b) => rank(a) - rank(b) || Math.abs(a.price - best.opt.price) - Math.abs(b.price - best.opt.price))
            : list;
    const shown = sorted.slice(0, Math.max(limit, sorted.findIndex((o) => o.id === cur?.id) + 1));
    return (
      <>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">{catLabel(cat)}</h2>
          <span className="shrink-0 text-xs text-muted">{required ? t.conf.required : t.conf.optional}</span>
        </div>
        {cur ? <p className="mt-1 truncate text-sm text-muted">✓ {cur.name}</p> : null}

        {adv && !query ? (
          <div className="mt-4 rounded-xl border border-line-2 bg-surface-2/50 p-3">
            <div className="text-xs font-semibold">{t.conf.recommend}</div>
            <p className="mt-0.5 text-xs text-muted">{adv.reason}</p>
            <div className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 sm:pb-0">
              {adv.picks.map((p) => (
                <button
                  key={p.opt.id}
                  type="button"
                  onClick={() => pick(cat, p.opt.id)}
                  className={`w-[160px] shrink-0 rounded-lg border bg-bg px-2.5 pt-2.5 pb-2 text-left transition-colors sm:w-auto ${cur?.id === p.opt.id ? "border-accent" : "border-line-2 hover:border-text/40"}`}
                >
                  <span className={`block h-[3px] w-7 rounded-full ${TAG_DOT[p.tag]}`} />
                  <span className="font-display mt-2 block text-[13px] leading-none font-semibold">{t.conf.tag[p.tag]}</span>
                  <span className="mt-1.5 line-clamp-2 block text-xs leading-snug text-muted">{p.opt.name}</span>
                  <span className="font-display mt-1.5 block text-[13px] font-semibold"><MoneyText text={money(r1k(p.opt.price))} /></span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {byCat[cat].length > 8 ? (
          <div className="mt-4 flex items-center gap-3">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(12);
              }}
              placeholder={t.conf.searchCat(catLabel(cat))}
              className="input min-w-0 flex-1 py-2"
            />
            <span className="shrink-0 text-xs text-muted">{t.conf.ofN(list.length, byCat[cat].length)}</span>
          </div>
        ) : null}
        {list.length > 3 ? (
          <div className="mt-3 flex gap-1.5 overflow-x-auto text-xs">
            {((best ? ["rec", "asc", "desc"] : ["asc", "desc"]) as ("rec" | "asc" | "desc")[]).map((m) => {
              const on = sort === m || (!best && sort === "rec" && m === "asc");
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setSort(m);
                    setLimit(12);
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1 transition-colors ${on ? "border-accent bg-accent text-accent-ink" : "border-line-2 text-muted hover:text-text"}`}
                >
                  {t.conf.sort[m]}
                </button>
              );
            })}
          </div>
        ) : null}

        {notice ? (
          <p className="mt-3 rounded-xl border border-warn/30 bg-warn/5 px-3 py-2 text-sm text-warn" role="status">{notice}</p>
        ) : null}
        {blockers.length && (hidden > 0 || showIncompat) ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-line-2 bg-surface-2/50 px-3 py-2 text-xs">
            <span className="text-muted">{showIncompat ? t.conf.allShown : t.conf.onlyCompat}</span>
            {blockers.map((d) => (
              <span key={d} className="inline-flex max-w-full items-center gap-1 rounded-full border border-line-2 bg-bg py-0.5 pr-1 pl-2.5">
                <span className="truncate">
                  {catLabel(d)}: {chosen[d]!.name.slice(0, 32)}
                </span>
                <button
                  type="button"
                  onClick={() => setSel((s) => ({ ...s, [d]: undefined }))}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-muted hover:bg-danger/10 hover:text-danger"
                  aria-label={`${t.conf.remove}: ${chosen[d]!.name}`}
                  title={t.conf.remove}
                >
                  ×
                </button>
              </span>
            ))}
            {showIncompat ? (
              <button type="button" onClick={() => setShowIncompat(false)} className="ml-auto text-muted underline-offset-2 hover:text-text hover:underline">
                {t.conf.onlyCompatBtn}
              </button>
            ) : (
              <button type="button" onClick={() => setShowIncompat(true)} className="ml-auto font-semibold text-accent underline-offset-2 hover:underline">
                {t.conf.showAll(hidden)}
              </button>
            )}
          </div>
        ) : null}

        <div className="mt-3 space-y-1 sm:space-y-1.5">
          {!required && cur ? (
            <button type="button" onClick={() => pick(cat, undefined)} className="w-full rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-surface-2">
              {t.conf.remove}
            </button>
          ) : null}
          {shown.map((o) => optionRow(o, cat, tagOf))}
          {list.length > shown.length ? (
            <button type="button" onClick={() => setLimit((n) => n + 20)} className="w-full rounded-xl border border-line-2 px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
              {t.conf.more(list.length - shown.length)}
            </button>
          ) : null}
          {!list.length ? <p className="px-3 py-4 text-sm text-muted">{t.conf.nothing}</p> : null}
          {hidden > 0 ? (
            <button type="button" onClick={() => setShowIncompat(true)} className="w-full rounded-xl border border-dashed border-line-2 px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
              {t.conf.showAll(hidden)}
            </button>
          ) : null}
        </div>
      </>
    );
  };

  // Итог: состав, проверки, советы и оформление
  const summary = () => (
    <>
      <h2 className="font-display text-2xl font-semibold">{t.conf.yourBuild}</h2>
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
        {steps.slice(0, -1).map((c, i) => (
          <li key={c} className="flex items-center">
            <button type="button" onClick={() => go(i)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">{catLabel(c)}</span>
                <span className="block truncate text-[13px] sm:text-sm">{chosen[c]?.name ?? <span className="text-muted">{t.conf.notSelected}</span>}</span>
              </span>
              {chosen[c] ? <span className="shrink-0 text-[13px] font-semibold whitespace-nowrap">{money(r1k(chosen[c]!.price))}</span> : null}
            </button>
            {chosen[c] ? (
              <button
                type="button"
                onClick={() => pick(c, undefined)}
                className="mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                aria-label={`${t.conf.remove}: ${chosen[c]!.name}`}
                title={t.conf.remove}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            ) : (
              <span className="mr-1.5 w-8 shrink-0" />
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1 text-sm">
        <div className="flex justify-between text-muted">
          <span>{t.conf.partsCount(parts.length)}</span>
          <span>{money(sum)}</span>
        </div>
        <div className="flex justify-between text-muted">
          <span>{t.conf.assembly}</span>
          <span>{money(assembly)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-sm text-muted">{t.conf.total}</span>
        <span className="font-display text-2xl font-semibold"><MoneyText text={money(total)} /></span>
      </div>
      {recommendedPsu ? <p className="mt-2 text-xs text-muted">{t.conf.psuRec(recommendedPsu)}</p> : null}
      {missing.length || issues.length ? (
        <ul className="mt-4 space-y-1.5 rounded-xl border border-warn/30 bg-warn/5 p-3 text-sm">
          {missing.length ? <li className="text-warn">{t.conf.choose(missing.map((m) => catLabel(m).toLowerCase()).join(", "))}</li> : null}
          {issues.map((i) => (
            <li key={i} className="text-warn">{i}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-ok/30 bg-ok/5 p-3 text-sm text-ok">{t.conf.allOk}</p>
      )}
      {[...nextAdvice, ...extraAdvice].map((a) => (
        <div key={a.cat} className="mt-4 rounded-xl border border-line p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold">
              {extraAdvice.includes(a) ? t.conf.canAdd : t.conf.next}: {catLabel(a.cat).toLowerCase()}
            </span>
            <button type="button" onClick={() => go(steps.indexOf(a.cat))} className="text-xs text-muted hover:text-text">{t.conf.all}</button>
          </div>
          <p className="mt-0.5 text-xs text-muted">{a.reason}</p>
          <ul className="mt-2 space-y-1.5">
            {a.picks.map((p) => (
              <li key={p.opt.id} className="flex items-center gap-2">
                <span className="flex w-[84px] shrink-0 items-center gap-1.5 text-[11px] text-muted">
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TAG_DOT[p.tag]}`} />
                  {t.conf.tag[p.tag]}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs">{p.opt.name}</span>
                <span className="shrink-0 text-xs font-semibold">{money(r1k(p.opt.price))}</span>
                <button
                  type="button"
                  onClick={() => pick(a.cat, p.opt.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent text-sm leading-none font-bold text-accent-ink hover:opacity-90"
                  aria-label={t.conf.add(p.opt.name)}
                >
                  +
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div id="conf-order" className="mt-6 scroll-mt-24 border-t border-line pt-6">
        <OrderForm
          hidden={{ source: "configurator", ids: JSON.stringify(parts.map((p) => p.id)) }}
          disabled={!ready}
          submitLabel={ready ? t.conf.orderBtn : t.conf.finish}
        />
      </div>
    </>
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 pb-24 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-8 lg:pb-0">
      {/* Слева: корпус с деталями и шаги */}
      <div id="conf-top" className="scroll-mt-28 lg:sticky lg:top-24 lg:self-start">
        {scene === "photo" ? (
          <PhotoScene
            items={steps
              .filter((c) => c !== "summary" && c !== "case" && chosen[c])
              .map((c) => ({ cat: c, label: catLabel(c), name: chosen[c]!.name, image: chosen[c]!.image, id: chosen[c]!.id }))}
            caseItem={chosen.case ? { cat: "case", label: catLabel("case"), name: chosen.case.name, image: chosen.case.image, id: chosen.case.id } : null}
            active={isSummary ? null : { cat, label: catLabel(cat) }}
            caseLabel={catLabel("case")}
            emptyCase={t.conf.notSelected}
            onRemove={(c) => pick(c, undefined)}
            removeLabel={t.conf.remove}
            footer={
              <div className="lg:flex lg:items-baseline lg:justify-between">
                <div className="text-xs text-muted">{t.conf.partsCount(parts.length)}</div>
                <div className="font-display text-xl font-semibold"><MoneyText text={money(total)} /></div>
              </div>
            }
          />
        ) : (
        <div className="card flex items-center gap-4 p-3 sm:p-5 lg:block">
          <div className="aspect-[300/340] w-28 shrink-0 sm:w-36 lg:w-full">
            <CaseScene has={has} active={isSummary ? undefined : cat} />
          </div>
          <div className="min-w-0 flex-1 lg:mt-3 lg:flex lg:items-baseline lg:justify-between">
            <div className="text-xs text-muted">{t.conf.partsCount(parts.length)}</div>
            <div className="font-display text-xl font-semibold"><MoneyText text={money(total)} /></div>
            <div className="mt-1 text-xs text-muted lg:hidden">{t.conf.step(step + 1, steps.length)}</div>
          </div>
        </div>
        )}
        {parts.length ? (
          <button type="button" onClick={resetAll} className="mt-2 text-xs text-muted underline-offset-2 hover:text-danger hover:underline">
            ↺ {t.conf.reset}
          </button>
        ) : null}
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
          {steps.map((c, i) => (
            <button
              key={c}
              type="button"
              onClick={() => go(i)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                i === step ? "border-accent bg-accent text-accent-ink" : chosen[c] ? "border-line-2 text-text" : "border-line text-muted hover:text-text"
              }`}
            >
              {c === "summary" ? t.conf.summary : `${chosen[c] ? "✓ " : ""}${catLabel(c)}`}
            </button>
          ))}
        </div>
      </div>

      {/* Справа: текущий шаг */}
      <div id="conf-panel" className="scroll-mt-20">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <span className="shrink-0 text-xs text-muted">{t.conf.step(step + 1, steps.length)}</span>
        </div>
        <div className="card p-4 sm:p-6">
          {isSummary ? summary() : stepPanel()}
          <div className="mt-6 hidden items-center justify-between gap-3 border-t border-line pt-4 lg:flex">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="btn-ghost disabled:opacity-40">
              ← {t.conf.back}
            </button>
            {!isSummary ? (
              <button type="button" onClick={next} className="btn-accent px-6">
                {chosen[cat] ? t.conf.nextBtn : t.conf.skip} →
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Телефон: закреплённая панель навигации по шагам */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => go(step - 1)} disabled={step === 0} className="btn-ghost shrink-0 px-3 py-2.5 disabled:opacity-40" aria-label={t.conf.back}>
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs text-muted">{isSummary ? t.conf.summary : catLabel(cat)}</div>
            <div className="font-display text-base leading-tight font-semibold sm:text-lg"><MoneyText text={money(total)} /></div>
          </div>
          {isSummary ? (
            <a href="#conf-order" className="btn-accent shrink-0 px-5 py-2.5">{t.conf.toOrder}</a>
          ) : (
            <button type="button" onClick={next} className="btn-accent shrink-0 px-5 py-2.5">
              {chosen[cat] ? t.conf.nextBtn : t.conf.skip} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
