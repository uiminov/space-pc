import Link from "next/link";
import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { QuoteForm } from "@/components/QuoteForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.b2b.metaTitle, description: t.b2b.metaDesc };
}

// Значки сфер: простые линейные пиктограммы в стиле сайта
const SEG_ICON: Record<string, React.ReactNode> = {
  club: <path d="M6 9h12a3 3 0 0 1 3 3v2a3 3 0 0 1-5.2 2L14 14h-4l-1.8 2A3 3 0 0 1 3 14v-2a3 3 0 0 1 3-3Zm2 2v3M6.5 12.5h3M15 12h.01M17 14h.01" />,
  it: <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13.5 6l-3 12" />,
  edu: <path d="M3 9l9-4 9 4-9 4-9-4Zm4 2v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5M21 9v5" />,
  studio: <path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4ZM14 7l3 3" />,
  office: <path d="M4 5h16v11H4zM9 20h6M12 16v4" />,
};

// Страница для компаний: сферы, преимущества, этапы и заявка на КП
export default async function Business({ searchParams }: PageProps<"/business">) {
  const sp = await searchParams;
  const { t } = await getT();
  const b = t.b2b;
  const segment = typeof sp.segment === "string" ? sp.segment : "office";

  return (
    <>
      <section className="border-b border-line">
        <div className="container-x py-14 sm:py-20">
          <p className="text-sm text-muted">{b.eyebrow}</p>
          <h1 className="font-display mt-4 max-w-3xl text-[clamp(1.9rem,4.2vw,3rem)] leading-[1.15] font-medium">{b.h1}</h1>
          <p className="mt-5 max-w-2xl text-[1.05rem] leading-relaxed text-muted">{b.lead}</p>
          <Link href="#quote" className="mt-8 inline-flex items-center rounded-full bg-accent px-7 py-3.5 text-[15px] font-semibold text-accent-ink transition-opacity hover:opacity-85">
            {b.quoteBtn}
          </Link>
          <ul className="mt-12 grid grid-cols-2 gap-y-5 border-t border-line pt-6 lg:grid-cols-4">
            {b.trust.map((x) => (
              <li key={x.t} className="pr-4">
                <div className="text-[15px] font-semibold">{x.t}</div>
                <div className="mt-1 text-sm text-muted">{x.d}</div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container-x mt-10 sm:mt-16">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{b.segTitle}</h2>
        <p className="mt-2 max-w-2xl text-muted">{b.segSub}</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {b.segments.map((x) => (
            <Link key={x.key} href={`/business?segment=${x.key}#quote`} scroll={false} className="card group flex flex-col p-5 hover:border-line-2">
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-text" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {SEG_ICON[x.key]}
              </svg>
              <h3 className="mt-4 font-semibold">{x.t}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{x.d}</p>
              <span className="mt-4 text-sm font-medium">
                {b.segBtn} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x mt-12 sm:mt-20">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{b.offerTitle}</h2>
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {b.offer.map((o, i) => (
            <div key={o.t} className="bg-surface p-6">
              <div className="font-display text-sm text-accent">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mt-2 font-semibold">{o.t}</h3>
              <p className="mt-2 text-sm text-muted">{o.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container-x mt-12 sm:mt-20">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{b.stepsTitle}</h2>
        <ol className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {b.steps.map((st, i) => (
            <li key={st.t} className="border-t border-line-2 pt-5">
              <div className="font-display text-sm text-accent">{String(i + 1).padStart(2, "0")}</div>
              <h3 className="mt-2 font-semibold">{st.t}</h3>
              <p className="mt-1 text-sm text-muted">{st.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="quote" className="container-x mt-12 sm:mt-20 scroll-mt-24">
        <div className="card grid grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">{b.formTitle}</h2>
            <p className="mt-3 text-muted">{b.formSub}</p>
          </div>
          <QuoteForm key={segment} segment={segment} />
        </div>
      </section>
    </>
  );
}
