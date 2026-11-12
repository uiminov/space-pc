import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireAdmin();
  const s = getSettings();
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Настройки</h1>
      <SettingsForm s={s} />
    </div>
  );
}
