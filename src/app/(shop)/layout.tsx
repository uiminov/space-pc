import Link from "next/link";
import { connection } from "next/server";
import { DEFAULT_SETTINGS, ensureFreshRate, getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { CartLink } from "@/components/CartButtons";
import { LangSwitch, ThemeSwitch } from "@/components/Switchers";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/MobileMenu";
import { CatalogMenu, SearchBox, catalogSections } from "@/components/CatalogMenu";
import { MENU_GROUPS, categoryCounts } from "@/lib/showcase";

export default async function ShopLayout({ children }: LayoutProps<"/">) {
  await connection();
  await ensureFreshRate();
  const { lang, t } = await getT();
  const s = getSettings();
  const tel = s.phone.replace(/[^\d+]/g, "");
  // пока в настройках стоит заглушка, телефон в шапке не показываем
  const addr = (lang === "uz" && s.address_uz.trim()) || s.address;
  const hours = (lang === "uz" && s.work_hours_uz.trim()) || s.work_hours;
  // пока адрес-заглушка не заменён в админке — показываем только город
  const addrShown = addr === DEFAULT_SETTINGS.address ? (lang === "uz" ? "Toshkent" : "Ташкент") : addr;
  const hasPhone = s.phone.trim() !== "" && s.phone !== DEFAULT_SETTINGS.phone;
  const sections = catalogSections(t, categoryCounts(), MENU_GROUPS);
  const nav = [
    { href: "/catalog", label: t.nav.builds, short: t.nav.buildsShort },
    { href: "/configurator", label: t.nav.configurator, short: t.nav.configurator },
    { href: "/business", label: t.b2b.navBusiness, short: t.b2b.navBusiness },
    { href: "/#contacts", label: t.nav.contacts, short: t.nav.contacts },
  ];
  return (
    <I18nProvider lang={lang}>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="container-x flex h-14 items-center gap-3 sm:h-16 sm:gap-6">
          <Link href="/" aria-label={s.shop_name}>
            <Logo name={s.shop_name} />
          </Link>
          <nav className="hidden items-center gap-0.5 text-sm xl:flex">
            <CatalogMenu label={t.menu.catalog} sections={sections} allLabel={t.menu.all} />
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 whitespace-nowrap text-muted hover:text-text">
                {n.short}
              </Link>
            ))}
          </nav>
          <SearchBox placeholder={t.menu.search} button={t.menu.searchBtn} className="ml-auto hidden w-52 xl:block 2xl:w-64" />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 xl:ml-0">
            {hasPhone ? (
              <a href={`tel:${tel}`} className="hidden font-mono text-sm xl:block">
                {s.phone}
              </a>
            ) : null}
            {s.telegram ? (
              <a href={`https://t.me/${s.telegram.replace("@", "")}`} target="_blank" className="btn-ghost hidden py-2 whitespace-nowrap sm:inline-flex">
                Telegram
              </a>
            ) : null}
            <LangSwitch />
            <ThemeSwitch />
            <CartLink />
            <MobileMenu items={nav.map((n) => ({ href: n.href, label: n.label }))} sections={sections} label={t.nav.menu} search={{ placeholder: t.menu.search, button: t.menu.searchBtn }} catalogLabel={t.menu.catalog} />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer id="contacts" className="mt-8 sm:mt-14 border-t border-line sm:mt-24">
        <div className="container-x grid grid-cols-2 gap-6 py-8 sm:gap-8 sm:py-12 lg:grid-cols-4">
          <div>
            <Logo name={s.shop_name} />
            <p className="mt-3 text-sm text-muted">{t.footer.about}</p>
          </div>
          <div className="text-sm">
            <div className="label">{t.footer.contact}</div>
            {hasPhone ? (
              <a href={`tel:${tel}`} className="block font-semibold">
                {s.phone}
              </a>
            ) : null}
            {s.telegram ? (
              <a href={`https://t.me/${s.telegram.replace("@", "")}`} className="mt-1 block text-muted hover:text-text">
                Telegram: @{s.telegram.replace("@", "")}
              </a>
            ) : null}
            {s.instagram ? (
              <a href={`https://instagram.com/${s.instagram.replace("@", "")}`} className="mt-1 block text-muted hover:text-text">
                Instagram: @{s.instagram.replace("@", "")}
              </a>
            ) : null}
          </div>
          <div className="text-sm">
            <div className="label">{t.footer.address}</div>
            <p>{addrShown}</p>
            <p className="mt-1 text-muted">{hours}</p>
          </div>
          <div className="text-sm">
            <div className="label">{t.footer.customers}</div>
            <Link href="/catalog" className="block text-muted hover:text-text">{t.nav.builds}</Link>
            <Link href="/parts" className="mt-1 block text-muted hover:text-text">{t.nav.parts}</Link>
            <Link href="/configurator" className="mt-1 block text-muted hover:text-text">{t.footer.buildOwn}</Link>
          </div>
        </div>
        <div className="container-x border-t border-line py-5 text-xs text-muted">
          © {new Date().getFullYear()} {s.shop_name}. {t.footer.note}
        </div>
      </footer>
    </I18nProvider>
  );
}
