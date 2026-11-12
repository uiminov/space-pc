"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import type { Lang } from "@/lib/i18n/dict";

const YEAR = 60 * 60 * 24 * 365;

function applyLang(l: Lang) {
  document.cookie = `lang=${l}; path=/; max-age=${YEAR}; samesite=lax`;
  document.documentElement.lang = l;
}

// Переключатель языка: запоминаем в cookie и перерисовываем страницу на сервере
export function LangSwitch() {
  const { lang } = useI18n();
  const router = useRouter();
  const set = (l: Lang) => {
    if (l === lang) return;
    applyLang(l);
    router.refresh();
  };
  return (
    <div className="flex rounded-xl border border-line-2 p-0.5 text-xs font-semibold" role="group" aria-label="Til / Язык">
      {(["uz", "ru"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => set(l)}
          aria-pressed={lang === l}
          className={`rounded-[9px] px-2 py-1 uppercase sm:px-2.5 sm:py-1.5 transition-colors ${lang === l ? "bg-text text-bg" : "text-muted hover:text-text"}`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

// День / ночь: меняем атрибут на <html> сразу и запоминаем выбор в cookie
export function ThemeSwitch() {
  const { t } = useI18n();
  const toggle = () => {
    const light = document.documentElement.dataset.theme !== "light";
    if (light) document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    document.cookie = `theme=${light ? "light" : "dark"}; path=/; max-age=${YEAR}; samesite=lax`;
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-xl border border-line-2 text-muted transition-colors hover:text-text"
      aria-label={`${t.theme.toDay} / ${t.theme.toNight}`}
      title={`${t.theme.toDay} / ${t.theme.toNight}`}
    >
      {/* в ночной теме показываем солнце, в дневной — луну (через CSS) */}
      <svg viewBox="0 0 24 24" className="theme-sun h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
      </svg>
      <svg viewBox="0 0 24 24" className="theme-moon h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}
