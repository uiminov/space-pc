import "server-only";
import { listParts } from "./repo";
import { PART_GROUPS } from "./catalog";

// Данные витрины для шапки и главной: сколько товаров в каждом разделе, «лицо» раздела
// (фото для плитки) и подборки товаров для лент на главной.

type Part = ReturnType<typeof listParts>["items"][number];

export const MENU_GROUPS = {
  laptops: ["laptop", "monitor"],
  parts: PART_GROUPS.find((g) => g.key === "pc")!.cats as readonly string[],
  more: ["periph", "chair", "office", "misc"],
} as const;

function byCategory() {
  const all = listParts({}).items;
  const m: Record<string, Part[]> = {};
  for (const p of all) (m[p.category] ||= []).push(p);
  return { all, m };
}

// Количество товаров по разделам (для меню «Каталог»)
export function categoryCounts(): Record<string, number> {
  const { m } = byCategory();
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v.length]));
}

// Самый «представительный» товар с фото: самый дорогой — обычно это флагман с лучшим фото
function face(items: Part[]) {
  return [...items].filter((p) => p.image).sort((a, b) => b.price - a.price)[0]?.image ?? null;
}

// N товаров с фото, равномерно по всему диапазону цен — чтобы в ленте были и недорогие, и топовые
function spread(items: Part[], n: number) {
  const list = items.filter((p) => p.image && p.in_stock).sort((a, b) => a.price - b.price);
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.round((i * (list.length - 1)) / (n - 1))]);
}

export type Tile = { key: string; href: string; count: number; min: number | null; image: string | null };

export function homeShowcase() {
  const { m } = byCategory();
  const minOf = (items: Part[]) => (items.length ? Math.min(...items.map((p) => p.price)) : null);
  const tile = (key: string, href: string, items: Part[], faceItems: Part[] = items): Tile => ({ key, href, count: items.length, min: minOf(items), image: face(faceItems) });
  const parts = MENU_GROUPS.parts.flatMap((c) => m[c] ?? []);
  const periph = m.periph ?? [];
  const tiles: Tile[] = [
    tile("laptop", "/parts/laptop", m.laptop ?? []),
    tile("monitor", "/parts/monitor", m.monitor ?? [], (m.monitor ?? []).filter((p) => p.specs.type === "Игровой")),
    tile("parts", "/parts", parts, m.gpu ?? parts),
    tile("periph", "/parts/periph", periph, periph.filter((p) => p.specs.type === "Наушники")),
    tile("chair", "/parts/chair", m.chair ?? []),
  ].filter((t) => t.count);
  const rows = [
    { key: "laptop", href: "/parts/laptop", items: spread((m.laptop ?? []).filter((p) => p.specs.type === "Ноутбук"), 10) },
    { key: "gamingMonitors", href: "/parts/monitor?f_type=" + encodeURIComponent("Игровой"), items: spread((m.monitor ?? []).filter((p) => p.specs.type === "Игровой"), 10) },
    { key: "periph", href: "/parts/periph", items: spread(periph, 10) },
  ].filter((r) => r.items.length >= 4);
  return { tiles, rows };
}
