import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Вход в админку" };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <Logo name={getSettings().shop_name} />
        <h1 className="font-display mt-6 text-xl font-bold">Админ-панель</h1>
        <p className="mt-1 text-sm text-muted">Введите пароль из переменной ADMIN_PASSWORD</p>
        <LoginForm />
      </div>
    </div>
  );
}
