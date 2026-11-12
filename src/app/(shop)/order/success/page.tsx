import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { getT } from "@/lib/i18n/server";
import { ClearCart } from "@/components/CartButtons";

export default async function Success({ searchParams }: PageProps<"/order/success">) {
  const { id, cart, b2b } = await searchParams;
  const { t } = await getT();
  const s = getSettings();
  return (
    <div className="container-x py-14 sm:py-24 text-center">
      {cart ? <ClearCart /> : null}
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink">✓</div>
      <h1 className="font-display mt-6 text-3xl font-semibold">{(b2b ? t.b2b.successTitle : t.success.title)(typeof id === "string" ? id : "")}</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">{b2b ? t.b2b.successText : t.success.text}</p>
      <div className="mt-8 flex justify-center gap-3">
        {s.telegram ? (
          <a href={`https://t.me/${s.telegram.replace("@", "")}`} className="btn-accent">
            {t.success.tg}
          </a>
        ) : null}
        <Link href="/catalog" className="btn-ghost">
          {t.success.back}
        </Link>
      </div>
    </div>
  );
}
