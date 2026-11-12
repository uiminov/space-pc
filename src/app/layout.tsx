import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import { getT, getTheme } from "@/lib/i18n/server";
import "./globals.css";

// Шрифты сайта (выбор владельца, 2026-11-12): Unbounded — заголовки, Manrope — текст.
// Оба с кириллицей и латиницей (узбекские o', g' отображаются корректно).
const display = Unbounded({ variable: "--font-display-src", subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], display: "swap" });
const body = Manrope({ variable: "--font-body-src", subsets: ["latin", "cyrillic"], weight: ["400", "500", "600", "700"], display: "swap" });
// моноширинный нужен только в характеристиках сборок — не загружаем заранее
const mono = JetBrains_Mono({ variable: "--font-mono-src", subsets: ["latin"], preload: false });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return {
    title: { default: t.meta.title, template: "%s — SPACE PC" },
    description: t.meta.description,
    applicationName: "SPACE PC",
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ lang }, theme] = await Promise.all([getT(), getTheme()]);
  return (
    <html
      lang={lang}
      data-theme={theme === "light" ? "light" : undefined}
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
