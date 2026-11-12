import type { Dict } from "@/lib/i18n/dict";

// Советы конфигуратора: что взять к уже выбранным комплектующим.
// Баланс по цене (ориентир — процессор или видеокарта) + технические правила совместимости и запаса.

export type AdvOption = {
  id: number;
  category: string;
  name: string;
  specs: Record<string, string>;
  image: string | null;
  price: number;
  inStock: boolean;
};

export type Pick = { opt: AdvOption; tag: "best" | "cheaper" | "better" };
export type Advice = { cat: string; reason: string; picks: Pick[] };

// Доля цены детали относительно цены процессора в сбалансированной сборке
const RATIO: Record<string, number> = { mb: 0.85, ram: 1.0, gpu: 3.2, ssd: 0.5, psu: 0.45, case: 0.4, cooler: 0.3, hdd: 0.35 };

const int = (s?: string) => parseInt((s ?? "").replace(/\D/g, "")) || 0;
const capGb = (s?: string) => {
  const t = (s ?? "").toLowerCase();
  const n = parseFloat(t.replace(",", "."));
  return isNaN(n) ? 0 : /тб|tb/.test(t) ? n * 1000 : n;
};

export function anchorPrice(chosen: Record<string, AdvOption | undefined>): number | null {
  if (chosen.cpu) return chosen.cpu.price;
  if (chosen.gpu) return chosen.gpu.price / RATIO.gpu;
  return null;
}

export function recommendedPsu(chosen: Record<string, AdvOption | undefined>) {
  const need = int(chosen.cpu?.specs.tdp) + int(chosen.gpu?.specs.tdp || (chosen.gpu ? "200" : "0"));
  return need ? Math.ceil((need * 1.3 + 120) / 50) * 50 : 0;
}

export function cpuHasCooler(cpu?: AdvOption) {
  return !!cpu && /\bbox\b/i.test(cpu.name);
}

// Подходящие варианты категории и объяснение, почему именно они
function candidates(cat: string, chosen: Record<string, AdvOption | undefined>, all: AdvOption[], t: Dict): { list: AdvOption[]; reason: string } {
  const cpu = chosen.cpu, gpu = chosen.gpu, mb = chosen.mb;
  const strong = (cpu?.price ?? 0) > 2_500_000 || (gpu?.price ?? 0) > 7_000_000;
  switch (cat) {
    case "mb":
      return {
        list: all,
        reason: cpu?.specs.socket ? t.adv.mb(cpu.specs.socket, chosen.ram?.specs.ram_type) : t.adv.mbFirst,
      };
    case "cooler": {
      const tdp = int(cpu?.specs.tdp);
      if (tdp >= 150) {
        const liquid = all.filter((o) => /сжо|360|280/i.test(`${o.specs.type ?? ""} ${o.name}`));
        return { list: liquid.length ? liquid : all, reason: t.adv.coolerLiquid(tdp) };
      }
      if (tdp >= 110) {
        const solid = all.filter((o) => !/^башня$/i.test(o.specs.type ?? "") || o.price > 400_000);
        return { list: solid.length ? solid : all, reason: t.adv.coolerStrong(tdp) };
      }
      return { list: all, reason: tdp ? t.adv.coolerTower(tdp) : t.adv.cooler };
    }
    case "ram": {
      const want = strong ? 32 : 16;
      const fit = all.filter((o) => capGb(o.specs.capacity) >= want);
      const type = mb?.specs.ram_type ?? "";
      return {
        list: fit.length ? fit : all,
        reason: t.adv.ram(want, type),
      };
    }
    case "gpu":
      return { list: all, reason: t.adv.gpu };
    case "ssd": {
      const fit = all.filter((o) => capGb(o.specs.capacity) >= (strong ? 1000 : 500));
      return { list: fit.length ? fit : all, reason: strong ? t.adv.ssdBig : t.adv.ssd };
    }
    case "psu": {
      const need = recommendedPsu(chosen);
      const fit = need ? all.filter((o) => int(o.specs.wattage) >= need) : all;
      return { list: fit.length ? fit : all, reason: need ? t.adv.psu(need) : t.adv.psuAny };
    }
    case "case":
      return { list: all, reason: mb?.specs.form_factor ? t.adv.case(mb.specs.form_factor) : t.adv.caseAny };
    case "hdd":
      return { list: all, reason: t.adv.hdd };
    default:
      return { list: all, reason: "" };
  }
}

export function adviseCategory(
  cat: string,
  chosen: Record<string, AdvOption | undefined>,
  options: AdvOption[],
  isCompatible: (o: AdvOption) => boolean,
  t: Dict,
): Advice | null {
  const anchor = anchorPrice(chosen);
  const pool = options.filter((o) => o.category === cat && isCompatible(o));
  if (!pool.length) return null;
  const { list, reason } = candidates(cat, chosen, pool, t);
  if (!list.length) return null;
  if (cat === "psu") return advisePsu(chosen, list, reason);
  const target = anchor && RATIO[cat] ? anchor * RATIO[cat] : null;
  const score = (o: AdvOption) => (target ? Math.abs(Math.log(o.price / target)) : 0) + (o.inStock ? 0 : 0.6) + (o.image ? 0 : 0.15);
  const sorted = [...list].sort((a, b) => score(a) - score(b) || a.price - b.price);
  const best = target ? sorted[0] : [...list].sort((a, b) => a.price - b.price)[Math.floor(list.length / 3)];
  const byPrice = [...list].sort((a, b) => a.price - b.price);
  const cheaper = [...byPrice].reverse().find((o) => o.price <= best.price * 0.8);
  const better = byPrice.find((o) => o.price >= best.price * 1.25 && o.price <= best.price * 2.2);
  const picks: Pick[] = [{ opt: best, tag: "best" }];
  if (cheaper) picks.push({ opt: cheaper, tag: "cheaper" });
  if (better) picks.push({ opt: better, tag: "better" });
  return { cat, reason, picks };
}

// Блок питания подбираем по мощности, а не по цене: хватает с запасом — и не переплачиваем
function advisePsu(chosen: Record<string, AdvOption | undefined>, list: AdvOption[], reason: string): Advice | null {
  const need = recommendedPsu(chosen) || 550;
  const w = (o: AdvOption) => int(o.specs.wattage);
  const good = (o: AdvOption) => /gold|platinum|titanium/i.test(`${o.specs.cert ?? ""} ${o.name}`);
  // наборы «корпус + БП» и позиции без мощности не советуем
  const psus = list.filter((o) => w(o) >= need && !/\+\s*бп|корпус|case/i.test(o.name)).sort((a, b) => a.price - b.price);
  if (!psus.length) return null;
  const inRange = psus.filter((o) => w(o) <= need * 1.5);
  const best = inRange.find(good) ?? inRange[0] ?? psus[0];
  const cheaper = psus.find((o) => o.id !== best.id && o.price < best.price * 0.9);
  const better = psus.find((o) => o.id !== best.id && w(o) >= w(best) + 150 && good(o) && o.price > best.price);
  const picks: Pick[] = [{ opt: best, tag: "best" }];
  if (cheaper) picks.push({ opt: cheaper, tag: "cheaper" });
  if (better) picks.push({ opt: better, tag: "better" });
  return { cat: "psu", reason, picks };
}

