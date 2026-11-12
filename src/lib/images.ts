import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { UPLOADS_DIR } from "./db";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Некорректная ссылка на фото");
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error("Ссылка должна начинаться с http(s)://");
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/i.test(u.hostname)) throw new Error("Недопустимый адрес");
  return u;
}

// Приводит картинку к единому виду: белый фон, пустые поля обрезаются, товар вписывается
// по центру квадрата 800×800 с одинаковым отступом — на сайте все фото одного «масштаба».
// (Та же функция — в scripts/fill-photos.mjs.)
export async function normalizeImage(buf: Buffer): Promise<Buffer> {
  const flat = await sharp(buf, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).png().toBuffer();
  let trimmed = flat;
  try {
    trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 20 }).png().toBuffer();
  } catch {}
  const inner = await sharp(trimmed).resize(704, 704, { fit: "inside" }).png().toBuffer();
  return sharp({ create: { width: 800, height: 800, channels: 3, background: "#ffffff" } })
    .composite([{ input: inner, gravity: "center" }])
    .webp({ quality: 82 })
    .toBuffer();
}

export async function saveImageBuffer(buf: Buffer): Promise<string> {
  const out = await normalizeImage(buf);
  const name = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.webp`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, name), out);
  return `/uploads/${name}`;
}

export async function fetchImage(url: string, referer?: string): Promise<Buffer | null> {
  const u = assertPublicUrl(url);
  const r = await fetch(u, { headers: { "user-agent": UA, ...(referer ? { referer } : {}) }, signal: AbortSignal.timeout(20000) });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.startsWith("image/")) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000 || buf.length > 15 * 1024 * 1024) return null;
  return buf;
}

export async function downloadImage(url: string): Promise<string> {
  const buf = await fetchImage(url);
  if (!buf) throw new Error("По ссылке нет картинки");
  return saveImageBuffer(buf);
}

async function fetchHtml(url: string): Promise<{ html: string; url: string } | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en" }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return { html: await r.text(), url: r.url };
  } catch {
    return null;
  }
}

function ogImage(html: string, base: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image/i);
  return m ? new URL(m[1], base).href : null;
}

// ---------- Источники ----------

export type PartRef = { brand: string | null; code: string | null; name: string; category: string };

async function icecat(brand: string, code: string): Promise<string | null> {
  const isGtin = /^\d{12,14}$/.test(code);
  const q = isGtin ? `GTIN=${code}` : `Brand=${encodeURIComponent(brand)}&ProductCode=${encodeURIComponent(code)}`;
  try {
    const r = await fetch(`https://live.icecat.biz/api/?UserName=openIcecat-live&Language=en&${q}`, { signal: AbortSignal.timeout(15000) });
    const j = (await r.json()) as { data?: { Image?: { HighPic?: string; Pic500x500?: string } } };
    return j.data?.Image?.Pic500x500 || j.data?.Image?.HighPic || null;
  } catch {
    return null;
  }
}

const DC_PLACEHOLDER = 154690; // так CDN DeepCool отвечает на несуществующие файлы

async function deepcool(p: PartRef): Promise<Buffer | null> {
  const t = p.name.replace(/\s+/g, " ");
  const m = t.match(/deepcool\s+(?:gamerstorm\s+)?([^(,]+)/i);
  if (!m) return null;
  let model = m[1].trim().replace(/\bwhite\b/i, "WH").replace(/\s+/g, " ");
  model = model.replace(/^(gamerstorm)\s+/i, "");
  const base = model.toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().replace(/ /g, "_");
  if (!base) return null;
  const isLiquid = /водян|liquid|^l[stqem]\d{3}|mystique|spartacus/i.test(t + " " + model);
  const folder =
    p.category === "case" ? ["Cases"] :
    p.category === "psu" ? ["PowerSupplyUnits"] :
    p.category === "cooler" ? (isLiquid ? ["Cooling/CPULiquidCoolers", "Cooling/CPUAirCoolers"] : ["Cooling/CPUAirCoolers", "Cooling/CPULiquidCoolers"]) : [];
  const names = [...new Set([base, base.replace(/_V\d$/, ""), base.replace(/_WH$/, "_WH"), `${base}_V2`])];
  for (const f of folder) {
    for (const n of names) {
      for (const size of ["608X760", "1216X1520"]) {
        try {
          const url = `https://cdn.deepcool.com/public/ProductFile/DEEPCOOL/${f}/${n}/Gallery/${size}/01.jpg?auto=format,compress&q=85&w=608`;
          const r = await fetch(url, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) });
          if (!r.ok) continue;
          const buf = Buffer.from(await r.arrayBuffer());
          if (buf.length !== DC_PLACEHOLDER && buf.length > 5000) return buf;
        } catch {}
      }
    }
  }
  return null;
}

function msiSlug(raw: string, category: string): { section: string; slugs: string[] } | null {
  let t = raw.replace(/\s+/g, " ").replace(/\([^)]*\)/g, " ");
  t = t.split(",")[0];
  t = t.replace(/^(MB|Корпус|Блок питание|Блок питания)\s*-?\s*/i, "").replace(/\bMSI\b\s*-?\s*/i, "");
  t = t.replace(/\b(AMD|AM5|AM4|LGA\s?\d{4})\b/gi, " ").replace(/\bCooler\b/i, " ").replace(/\s+/g, " ").trim();
  if (category === "gpu") {
    const g = t.match(/(\d+)GB\s+GeForce\s+RTX\s?(\d{4})(Ti)?\s+(.+)/i);
    if (!g) return null;
    const rest = g[4].trim().replace(/\s+/g, "-");
    return { section: "Graphics-Card", slugs: [`GeForce-RTX-${g[2]}${g[3] ? "-Ti" : ""}-${g[1]}G-${rest}`] };
  }
  const section = category === "mb" ? "Motherboard" : category === "psu" ? "Power-Supply" : category === "case" ? "PC-Case" : category === "cooler" ? "Liquid-Cooling" : null;
  if (!section) return null;
  const withRam = t.replace(/\s+/g, "-");
  const noRam = t.replace(/\b(DDR[45]|D[45])\b/gi, "").trim().replace(/\s+/g, "-");
  const slugs = [...new Set([noRam, withRam, withRam.replace(/-DDR5$/i, ""), noRam.replace(/-WIFI\d?E?$/i, "-WIFI")])].filter(Boolean);
  return { section, slugs };
}

async function msi(p: PartRef): Promise<string | null> {
  const s = msiSlug(p.name, p.category);
  if (!s) return null;
  for (const slug of s.slugs) {
    const page = await fetchHtml(`https://www.msi.com/${s.section}/${slug}`);
    if (!page) continue;
    const img = ogImage(page.html, page.url);
    if (img && /storage-asset\.msi\.com\/.+product/i.test(img)) return img;
  }
  return null;
}

async function amd(p: PartRef): Promise<string | null> {
  const m = p.name.replace(/™/g, "").match(/Ryzen\s+(\d)\s+(?:[A-Za-z]+\s+){0,2}(\d{4}X3D|\d{4}X|\d{4}F|\d{4}G|\d{4})/i);
  if (!m) return null;
  const model = m[2].toLowerCase();
  const series = `${model[0]}000-series`;
  const page = await fetchHtml(`https://www.amd.com/en/products/processors/desktops/ryzen/${series}/amd-ryzen-${m[1]}-${model}.html`);
  if (!page) return null;
  const img = ogImage(page.html, page.url);
  return img && !/header\/ogimage/.test(img) ? img : null;
}

// Intel не публикует фото отдельных моделей — используем официальные значки серии
async function intel(p: PartRef): Promise<string | null> {
  const t = p.name.toLowerCase();
  const tier = t.match(/core\s*i\s*-?\s*([3579])|i([3579])\s*-/);
  const n = tier ? tier[1] || tier[2] : null;
  if (!n) return null;
  return `https://www.intel.com/content/dam/www/central-libraries/xl/es/images/2022-06/km-1920x1080-i${n}.png`;
}

// Ищет фото по цепочке источников; возвращает путь к сохранённому файлу или null
export async function findAndSaveImage(p: PartRef): Promise<{ path: string; source: string } | null> {
  const brand = (p.brand || "").toLowerCase();
  const tryUrl = async (url: string | null, source: string) => {
    if (!url) return null;
    try {
      const buf = await fetchImage(url);
      return buf ? { path: await saveImageBuffer(buf), source } : null;
    } catch {
      return null;
    }
  };

  if (brand === "deepcool") {
    const buf = await deepcool(p);
    if (buf) return { path: await saveImageBuffer(buf), source: "deepcool.com" };
  }
  if (brand === "amd" && p.category === "cpu") {
    const r = await tryUrl(await amd(p), "amd.com");
    if (r) return r;
  }
  if (brand === "intel" && p.category === "cpu") {
    const r = await tryUrl(await intel(p), "intel.com");
    if (r) return r;
  }
  if (p.brand) {
    const fromName = [...p.name.matchAll(/\(([A-Z0-9][A-Z0-9.\-/]{5,})\)/gi)].map((m) => m[1]);
    const inName = p.name.match(/\b(GV-[A-Z0-9\- ]+?-\d+GD|[A-Z0-9]{2,}-[A-Z0-9-]{4,})\b/i)?.[1];
    const codes = [...new Set([p.code && p.code !== p.name ? p.code : "", p.code?.split(/\s*[/|]\s*/)[0] ?? "", ...fromName, inName ?? ""])].filter(
      (c) => c && c.length >= 5 && c.length <= 40 && !/\s{2}/.test(c),
    );
    for (const c of codes) {
      const r = await tryUrl(await icecat(p.brand, c), "icecat");
      if (r) return r;
    }
  }
  if (brand === "msi") {
    const r = await tryUrl(await msi(p), "msi.com");
    if (r) return r;
  }
  return null;
}
