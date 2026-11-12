import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { UPLOADS_DIR } from "@/lib/db";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
};

// Уменьшенные копии для карточек: /uploads/x.webp?w=400. Делаются один раз и лежат
// в data/uploads/.thumbs2/<ширина>/ — карточке шириной ~220px не нужно грузить фото 800×800.
// Копия «выравнивается»: пустые поля вокруг товара обрезаются, и товар вписывается в квадрат
// с одинаковым отступом — поэтому в сетке все товары одного размера и по центру.
const WIDTHS = new Set([200, 400]);
const THUMBS_DIR = path.join(UPLOADS_DIR, ".thumbs2");
const FILL = 0.84; // доля квадрата, которую занимает товар

async function normalize(src: Buffer, w: number): Promise<Buffer> {
  const flat = await sharp(src, { failOn: "none" }).rotate().flatten({ background: "#ffffff" }).toBuffer();
  let body = flat;
  try {
    // обрезаем рамку цвета левого верхнего пикселя (обычно белый фон фото)
    body = await sharp(flat).trim({ threshold: 24 }).toBuffer();
  } catch {}
  const inner = Math.round(w * FILL);
  const fitted = await sharp(body).resize(inner, inner, { fit: "inside", withoutEnlargement: false }).toBuffer({ resolveWithObject: true });
  const { width = inner, height = inner } = fitted.info;
  const left = Math.floor((w - width) / 2);
  const top = Math.floor((w - height) / 2);
  return sharp(fitted.data)
    .extend({ left, right: w - width - left, top, bottom: w - height - top, background: "#ffffff" })
    .webp({ quality: 80 })
    .toBuffer();
}
const CACHE = "public, max-age=31536000, immutable";

async function thumb(file: string, name: string, w: number): Promise<Buffer | null> {
  const out = path.join(THUMBS_DIR, String(w), name.replace(/\.[a-z]+$/i, ".webp"));
  try {
    return await fs.readFile(out);
  } catch {}
  try {
    const buf = await normalize(await fs.readFile(file), w);
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, buf).catch(() => {});
    return buf;
  } catch {
    return null;
  }
}

export async function GET(req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: parts } = await ctx.params;
  const file = path.normalize(path.join(UPLOADS_DIR, ...parts));
  if (!file.startsWith(UPLOADS_DIR + path.sep) || file.startsWith(THUMBS_DIR)) return new Response("Not found", { status: 404 });
  const type = TYPES[path.extname(file).toLowerCase()];
  if (!type) return new Response("Not found", { status: 404 });
  const w = Number(new URL(req.url).searchParams.get("w"));
  if (WIDTHS.has(w) && type !== "image/gif") {
    const data = await thumb(file, parts.join("_"), w);
    if (data) return new Response(new Uint8Array(data), { headers: { "content-type": "image/webp", "cache-control": CACHE } });
  }
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { "content-type": type, "cache-control": CACHE },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
