import Link from "next/link";
import { connection } from "next/server";
import { listBuilds, locBuild } from "@/lib/repo";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";
import { toCard } from "@/lib/view";
import { BuildCard } from "@/components/BuildCard";
import { Hero } from "@/components/Hero";
import { PromoBanner } from "@/components/PromoBanner";
import { PartIcon } from "@/components/PartIcon";
import { PartCard } from "@/components/PartCard";
import { ProductImage } from "@/components/ProductImage";
import { MoneyText } from "@/components/MoneyText";
import { homeShowcase } from "@/lib/showcase";

// Главная, вариант B «Сначала компьютеры» (выбран 2026-11-11):
// первый экран → «Готовый или свой?» → популярные сборки → «Ещё у нас» (плитки разделов) →
// ленты ноутбуков и игровых мониторов → «Почему мы» вместе с «Как мы работаем» → для бизнеса.
export default async function Home() {
  await connection();
  const { lang, t } = await getT();
  const s = getSettings();
  const builds = listBuilds({ activeOnly: true });
  const featured = builds.filter((b) => b.featured).slice(0, 3);
  const show = featured.length ? featured : builds.slice(0, 3);
  // цена «от» и сборка, чей корпус на фото первого экрана
  const prices = builds.map((b) => b.price).filter((p): p is number => p != null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const photo = builds.find((b) => b.slug === "optima");
  const { tiles, rows } = homeShowcase();
  const cards = builds.map((b) => toCard(b, s, lang));
  // фото для карточки «Готовый компьютер» — самая дорогая сборка с фото, но не та, что на первом экране
  const readyImage = [...cards].sort((a, b) => (b.price ?? 0) - (a.price ?? 0)).find((c) => c.image && c.slug !== photo?.slug)?.image ?? null;
  const tileLabel = (k: string) => (k === "parts" ? t.menu.parts : t.catPlural[k] ?? k);
  const rowTitle = (k: string) => (k === "gamingMonitors" ? t.menu.gamingMonitors : t.catPlural[k] ?? k);
  const bRows = rows.filter((r) => r.key === "laptop" || r.key === "gamingMonitors");
  const h2 = "font-display text-xl font-semibold sm:text-3xl";

  return (
    <>
      <Hero lang={lang} minPrice={minPrice} months={s.installment_months} sub={(lang === "uz" ? s.hero_sub_uz : s.hero_sub_ru).trim()} photoBuild={photo ? { slug: photo.slug, name: locBuild(photo, lang).name } : null} />

      <PromoBanner s={s} lang={lang} />

      {/* Готовый или свой: два пути покупки компьютера */}
      <section className="container-x mt-8 sm:mt-12">
        <h2 className={h2}>{t.home.chooseTitle}</h2>
        <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-5">
          <Link href="/catalog" className="card group grid grid-cols-[minmax(0,1fr)_30%] items-stretch overflow-hidden transition-colors hover:border-line-2 sm:grid-cols-[minmax(0,1fr)_38%]">
            <div className="flex min-w-0 flex-col p-4 sm:p-7">
              <div className="font-display text-lg font-semibold sm:text-2xl">{t.home.chooseReady.t}</div>
              <p className="mt-2 line-clamp-3 text-[13px] text-muted sm:line-clamp-none sm:text-sm">{t.home.chooseReady.d}</p>
              {minPrice != null ? (
                <div className="mt-3 text-sm">
                  <span className="text-muted">{lang === "uz" ? "" : "от "}</span>
                  <span className="font-display font-semibold"><MoneyText text={t.money(minPrice)} /></span>
                  <span className="text-muted">{lang === "uz" ? " dan" : ""}</span>
                </div>
              ) : null}
              <span className="mt-auto pt-4 sm:pt-5"><span className="btn-accent px-4 text-[13px] whitespace-nowrap sm:px-5 sm:text-sm">{t.home.chooseReady.btn} →</span></span>
            </div>
            <ProductImage src={readyImage} category="case" className="h-full min-h-32 sm:min-h-40 border-l border-line" pad="p-4" zoom sizes="(min-width: 640px) 240px, 30vw" />
          </Link>
          <Link href="/configurator" className="card group grid grid-cols-[minmax(0,1fr)_30%] items-stretch overflow-hidden transition-colors hover:border-line-2 sm:grid-cols-[minmax(0,1fr)_38%]">
            <div className="flex min-w-0 flex-col p-4 sm:p-7">
              <div className="font-display text-lg font-semibold sm:text-2xl">{t.home.chooseOwn.t}</div>
              <p className="mt-2 line-clamp-3 text-[13px] text-muted sm:line-clamp-none sm:text-sm">{t.home.chooseOwn.d}</p>
              <span className="mt-auto pt-4 sm:pt-5"><span className="btn-ghost px-4 text-[13px] whitespace-nowrap sm:px-5 sm:text-sm">{t.home.chooseOwn.btn} →</span></span>
            </div>
            {/* шаги конструктора: процессор → плата → видеокарта → корпус */}
            <div className="grid min-h-32 sm:min-h-40 grid-cols-2 place-items-center gap-2 border-l border-line bg-surface-2 p-4">
              {["cpu", "mb", "gpu", "case"].map((c) => (
                <PartIcon key={c} category={c} className="h-9 w-9 transition-transform duration-300 group-hover:scale-110 sm:h-11 sm:w-11" />
              ))}
            </div>
          </Link>
        </div>
      </section>

      <section className="container-x mt-12 sm:mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className={h2}>{t.home.popular}</h2>
          <Link href="/catalog" className="shrink-0 text-sm text-muted hover:text-text">
            {t.home.allBuilds(builds.length)} →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {show.map((b) => (
            <BuildCard key={b.id} b={cards[builds.indexOf(b)]} lang={lang} />
          ))}
        </div>
      </section>

      {/* Ещё у нас: остальные разделы магазина */}
      <section className="container-x mt-12 sm:mt-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className={h2}>{t.home.moreTitle}</h2>
          <Link href="/parts" className="shrink-0 text-sm text-muted hover:text-text">{t.menu.all} →</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tiles.map((tl) => (
            <Link key={tl.key} href={tl.href} className="card group flex flex-col overflow-hidden transition-colors hover:border-line-2">
              <ProductImage src={tl.image} category={tl.key === "parts" ? "gpu" : tl.key} className="aspect-[4/3] border-b border-line" pad="p-4" iconClass="h-12 w-12" zoom />
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <div className="font-display line-clamp-2 min-h-[2.5em] text-sm leading-tight font-semibold sm:text-base">{tileLabel(tl.key)}</div>
                <div className="mt-1 text-xs text-muted">{tl.min != null ? t.parts.tile(tl.count, t.money(tl.min)) : tl.count}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Ленты товаров: ноутбуки и игровые мониторы */}
      {bRows.map((r) => (
        <section key={r.key} className="container-x mt-12 sm:mt-16">
          <div className="flex items-end justify-between gap-4">
            <h2 className={h2}>{rowTitle(r.key)}</h2>
            <Link href={r.href} className="shrink-0 text-sm text-muted hover:text-text">{t.menu.seeAll} →</Link>
          </div>
          <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
            {r.items.map((p) => (
              <div key={p.id} className="flex w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-3.75rem)/6)]">
                <div className="flex w-full [&>*]:w-full">
                  <PartCard p={{ id: p.id, name: p.name, category: p.category, image: p.image, price: p.price, inStock: p.in_stock, specs: p.specs }} lang={lang} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Почему мы и как мы работаем — одним блоком */}
      <section id="why" className="container-x mt-12 scroll-mt-24 sm:mt-20">
        <h2 className={h2}>{t.home.whyTitle}</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {t.home.why.map((w) => (
            <div key={w.t} className="card p-5 sm:p-6">
              <div className="mb-3 h-1 w-10 rounded bg-accent" />
              <h3 className="font-semibold">{w.t}</h3>
              <p className="mt-1.5 text-sm text-muted">{w.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-xs font-medium tracking-wide text-muted uppercase">{t.home.stepsTitle}</div>
        <ol className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.steps.map((st, i) => (
            <li key={st.t} className="flex gap-3">
              <span className="font-display grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line-2 text-xs text-accent">{i + 1}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold">{st.t}</div>
                <p className="text-xs text-muted">{st.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Для компаний — одна плашка со ссылкой на отдельную страницу */}
      <section className="container-x mt-12 sm:mt-16">
        <Link href="/business" className="group flex flex-col gap-4 rounded-2xl border border-line p-6 hover:border-line-2 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-display text-xl font-semibold">{t.b2b.bannerTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{t.b2b.bannerText}</p>
          </div>
          <span className="shrink-0 text-sm font-semibold whitespace-nowrap">
            {t.b2b.bannerBtn} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
          </span>
        </Link>
      </section>
    </>
  );
}
