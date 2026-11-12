export function formatSum(value: number | null | undefined) {
  if (value == null || !isFinite(value)) return "—";
  return Math.round(value).toLocaleString("ru-RU").replace(/ /g, " ") + " сум";
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value == null || !isFinite(value)) return "—";
  return value.toLocaleString("ru-RU", { maximumFractionDigits: digits }).replace(/ /g, " ");
}

export function slugify(s: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
    к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
    х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  };
  return s
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatDate(sqlite: string) {
  const d = new Date(sqlite.replace(" ", "T") + "Z");
  return d.toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function partHref(id: number, name: string) {
  return `/part/${id}-${slugify(name)}`;
}
