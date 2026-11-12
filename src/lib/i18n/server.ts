import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LANG, DICTS, isLang, type Lang } from "./dict";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return isLang(v) ? v : DEFAULT_LANG;
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: DICTS[lang] };
}

export async function getTheme(): Promise<"dark" | "light"> {
  return (await cookies()).get("theme")?.value === "light" ? "light" : "dark";
}
