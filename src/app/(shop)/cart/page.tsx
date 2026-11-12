import type { Metadata } from "next";
import { CartView } from "./CartView";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.meta.cart };
}

export default async function CartPage() {
  const { t } = await getT();
  return (
    <div className="container-x py-6 sm:py-10">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.cart.title}</h1>
      <CartView />
    </div>
  );
}
