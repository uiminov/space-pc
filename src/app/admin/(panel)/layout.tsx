import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureFreshRate, getSettings } from "@/lib/settings";
import { logout } from "../actions";
import { AdminNav } from "./AdminNav";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Админка" };

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  await ensureFreshRate();
  const s = getSettings();
  const newOrders = (db().prepare("SELECT COUNT(*) AS c FROM orders WHERE status = 'new'").get() as { c: number }).c;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo name={s.shop_name} />
            <span className="text-xs text-muted">admin</span>
          </Link>
        </div>
        <AdminNav newOrders={newOrders} />
        <div className="hidden space-y-1 border-t border-line p-3 md:block">
          <Link href="/" target="_blank" className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-text">
            Открыть сайт ↗
          </Link>
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-text">Выйти</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
