import "server-only";
import type { BuildFull } from "./repo";
import { installment, locBuild } from "./repo";
import { DICTS, locSpec, type Lang } from "./i18n/dict";
import type { BuildCardData } from "@/components/BuildCard";
import type { Settings } from "./settings";

const short = (s?: string) =>
  (s ?? "")
    .replace(/\b(BOX|OEM|M\.2 NVMe)\b/gi, "")
    .replace(/GeForce |Radeon /g, "")
    .replace(/\s+/g, " ")
    .trim();

export function toCard(b: BuildFull, s: Settings, lang: Lang = "ru"): BuildCardData {
  const t = DICTS[lang];
  const L = locBuild(b, lang);
  const cpu = b.byCategory.cpu?.[0];
  const gpu = b.byCategory.gpu?.[0];
  const ram = b.byCategory.ram?.[0];
  const ssd = b.byCategory.ssd?.[0];
  const specs = [
    { label: "CPU", value: short(cpu?.name) || "—" },
    { label: "GPU", value: gpu ? short(gpu.name) : t.card.integrated },
    { label: "RAM", value: ram?.specs.capacity ? locSpec(`${ram.specs.capacity} ${ram.specs.ram_type ?? ""}`.trim(), lang) : short(ram?.name) || "—" },
    { label: "SSD", value: locSpec(ssd?.specs.capacity ?? "", lang) || short(ssd?.name) || "—" },
  ];
  const inst = b.price != null ? installment(b.price, s) : null;
  return {
    id: b.id,
    slug: b.slug,
    name: L.name,
    tagline: L.tagline,
    purpose: b.purpose,
    image: b.image ?? b.byCategory.case?.[0]?.image ?? null,
    price: b.price,
    available: b.available,
    featured: b.featured,
    specs,
    monthly: inst?.monthly,
    months: inst?.months,
  };
}
