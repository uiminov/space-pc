import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { BannerForm } from "./BannerForm";

export default async function BannerAdmin() {
  await requireAdmin();
  const s = getSettings();
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-semibold">Баннер и главная</h1>
      <p className="mt-1 text-sm text-muted">Объявления, акции и новости — показываются на главной сразу под первым экраном.</p>
      <BannerForm s={s} />
    </div>
  );
}
