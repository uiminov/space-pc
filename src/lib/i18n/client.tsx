"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LANG, DICTS, type Lang } from "./dict";

const Ctx = createContext<Lang>(DEFAULT_LANG);

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <Ctx.Provider value={lang}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const lang = useContext(Ctx);
  return { lang, t: DICTS[lang] };
}
