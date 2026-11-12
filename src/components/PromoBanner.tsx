import Link from "next/link";
import type { Lang } from "@/lib/i18n/dict";
import type { Settings } from "@/lib/settings";

// Баннер-объявление на главной: текст задаётся в админке («Баннер и главная»)
export function PromoBanner({ s, lang }: { s: Settings; lang: Lang }) {
  if (s.banner_on !== "1") return null;
  const pick = (uz: string, ru: string) => (lang === "uz" ? uz || ru : ru || uz).trim();
  const title = pick(s.banner_title_uz, s.banner_title_ru);
  const text = pick(s.banner_text_uz, s.banner_text_ru);
  const btn = pick(s.banner_btn_uz, s.banner_btn_ru);
  if (!title && !text && !s.banner_image) return null;
  const external = /^https?:/.test(s.banner_link);

  return (
    <section className="container-x mt-10">
      <div className="card grid grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-center p-6 sm:p-10">
          {title ? <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2> : null}
          {text ? <p className="mt-3 max-w-xl whitespace-pre-line text-muted">{text}</p> : null}
          {s.banner_link && btn ? (
            <Link
              href={s.banner_link}
              target={external ? "_blank" : undefined}
              className="mt-6 inline-flex w-fit items-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-opacity hover:opacity-85"
            >
              {btn}
            </Link>
          ) : null}
        </div>
        {s.banner_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.banner_image} alt={title} className="h-full max-h-80 w-full object-cover md:max-h-none" />
        ) : null}
      </div>
    </section>
  );
}
