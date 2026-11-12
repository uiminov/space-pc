import Link from "next/link";
import { DICTS, type Lang } from "@/lib/i18n/dict";

// Первый экран: студийный кадр компьютера на тёмном фоне, строгий заголовок, полоса доверия
export function Hero({ lang, minPrice, months, sub, photoBuild }: { lang: Lang; minPrice: number | null; months: string; sub?: string; photoBuild: { slug: string; name: string } | null }) {
  const t = DICTS[lang];
  const [price, rest] = minPrice ? t.hero.from("§PRICE§", months).split("§PRICE§") : ["", ""];
  return (
    <section className="relative overflow-hidden border-b border-line bg-bg">
      {/* свет студии */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="starfield absolute inset-0 opacity-70 [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_75%)]" />
        <div className="absolute top-[8%] right-[4%] h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgb(var(--glow)/0.10),transparent_65%)] blur-2xl lg:right-[10%]" />
        <div className="absolute top-[30%] right-[18%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgb(var(--glow)/0.06),transparent_65%)] blur-2xl" />
        <div className="absolute inset-x-0 bottom-[96px] h-px bg-gradient-to-r from-transparent via-line-2 to-transparent max-lg:hidden" />
      </div>

      {/* Телефон: заголовок во всю ширину, ниже — текст и кнопки слева, фото корпуса справа (экран компактный,
          плитки разделов видны сразу). Планшет: всё в одну колонку. Компьютер: текст слева, фото справа. */}
      <div className="container-x relative grid grid-cols-[minmax(0,1fr)_36%] items-center gap-x-3 gap-y-4 pt-6 [grid-template-areas:'h_h''t_p'] sm:grid-cols-[minmax(0,1fr)_40%] sm:gap-x-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-y-0 lg:pt-10 lg:[grid-template-areas:'h_p''t_p']">
        <h1 className="font-display text-[clamp(1.6rem,7.4vw,3rem)] leading-[1.14] font-medium [grid-area:h] lg:self-end lg:text-[clamp(2.4rem,4.1vw,3.6rem)]">
          {t.hero.h1a}
          <span className="block text-accent">{t.hero.h1b}</span>
        </h1>
        <div className="self-start [grid-area:t] lg:pb-24">
          <p className="line-clamp-4 max-w-lg text-[13px] leading-relaxed text-muted sm:mt-6 sm:line-clamp-none sm:text-[1.05rem]">
            {sub || t.hero.sub}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 sm:mt-9 sm:gap-x-7 sm:gap-y-4">
            <Link
              href="/catalog"
              className="inline-flex items-center rounded-full bg-accent px-5 py-2.5 text-sm sm:text-[15px] font-semibold text-accent-ink shadow-[0_0_24px_rgb(var(--glow)/0.35)] sm:px-7 sm:py-3.5 transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text"
            >
              {t.hero.cta}
            </Link>
            <Link href="/configurator" className="group text-sm font-medium text-text sm:text-[15px]">
              {t.hero.ctaConf} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
          {minPrice ? (
            <p className="mt-4 text-xs text-muted sm:mt-6 sm:text-sm">
              {price}
              <span className="text-text">{t.money(minPrice)}</span>
              {rest}
            </p>
          ) : null}
        </div>

        <div className="relative mx-auto w-full max-w-[560px] self-start pb-6 [grid-area:p] lg:max-w-none lg:pb-0 lg:self-center">
          <div className="relative mx-auto aspect-[1021/1338] w-full max-w-[470px] lg:w-[74%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/img/hero/cg580.webp" srcSet="/img/hero/cg580-420.webp 420w, /img/hero/cg580.webp 1021w" sizes="(min-width: 1024px) 470px, (min-width: 640px) 40vw, 36vw" alt={t.hero.photoAlt} fetchPriority="high" className="relative z-10 h-full w-full object-contain" />
            {/* отражение на полу */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/hero/cg580-420.webp"
              alt=""
              aria-hidden="true"
              className="absolute top-full left-0 h-full w-full -scale-y-100 object-contain opacity-[0.16] [mask-image:linear-gradient(to_bottom,black,transparent_28%)]"
            />
            <div className="absolute -bottom-3 left-1/2 h-8 w-[90%] -translate-x-1/2 rounded-[50%] bg-black/60 blur-xl" aria-hidden="true" />
          </div>
          {photoBuild ? (
            <Link href={`/build/${photoBuild.slug}`} className="relative z-10 mt-6 mb-8 hidden text-center text-xs text-muted hover:text-text lg:mt-8 lg:block">
              {t.hero.photo(photoBuild.name)}
            </Link>
          ) : null}
        </div>
      </div>

      <ul className="container-x relative hidden grid-cols-2 border-t border-line sm:grid lg:grid-cols-4">
        {t.hero.trust.map((x, i) => (
          <li key={x.t} className={`py-3 pr-3 sm:py-5 sm:pr-4 ${i % 2 ? "pl-4 sm:pl-6" : ""} ${i > 0 ? "lg:border-l lg:border-line lg:pl-6" : ""} ${i === 1 || i === 3 ? "border-l border-line" : ""} ${i > 1 ? "max-lg:border-t max-lg:border-line" : ""}`}>
            <div className="text-sm font-medium text-text">{x.t}</div>
            <div className="mt-0.5 text-xs text-muted">{x.d}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
