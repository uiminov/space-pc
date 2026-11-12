import ExcelJS from "exceljs";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { pricing, roundUp } from "@/lib/repo";
import { categoryLabel, guessCategory } from "@/lib/catalog";
import { displayCode, SUPPLIERS } from "@/lib/suppliers";

// Прайс поставщика, пересчитанный в сумы по текущему курсу: оптовая цена и розница с нашей наценкой
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const s = getSettings();
  const pr = pricing(s);
  const sup = SUPPLIERS.find((x) => x.key === new URL(req.url).searchParams.get("s"))?.key ?? "age";
  const rows = db()
    .prepare("SELECT code, name, price, in_stock, category FROM price_items WHERE supplier = ? ORDER BY category, name")
    .all(sup) as { code: string; name: string; price: number; in_stock: number; category: string | null }[];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Прайс в сумах");
  ws.columns = [
    { header: "Код", key: "code", width: 26 },
    { header: "Наименование", key: "name", width: 70 },
    { header: "Категория", key: "category", width: 20 },
    { header: `Цена, ${s.price_currency}`, key: "usd", width: 12 },
    { header: "Опт, сум", key: "uzs", width: 16 },
    { header: `Розница (+${pr.markup}%), сум`, key: "retail", width: 20 },
    { header: "Наличие", key: "stock", width: 10 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of rows) {
    const uzs = r.price * pr.rate;
    ws.addRow({
      code: displayCode(r.code) === r.name ? "" : displayCode(r.code),
      name: r.name,
      category: r.category || categoryLabel(guessCategory(r.name)),
      usd: r.price,
      uzs: Math.round(uzs),
      retail: roundUp(uzs * (1 + pr.markup / 100), 1000),
      stock: r.in_stock ? "есть" : "нет",
    });
  }
  for (const k of ["uzs", "retail"]) ws.getColumn(k).numFmt = "# ##0";
  ws.addRow([]);
  ws.addRow([`Курс: 1 USD = ${pr.rate.toLocaleString("ru-RU")} сум${s.usd_rate_date ? ` (ЦБ РУз на ${s.usd_rate_date})` : ""}`]);

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="price-${sup}-uzs-${date}.xlsx"`,
    },
  });
}
