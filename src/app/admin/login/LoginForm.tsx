"use client";

import { useActionState } from "react";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-3">
      <input name="password" type="password" required autoFocus className="input" placeholder="Пароль" />
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <button className="btn-accent w-full" disabled={pending}>
        {pending ? "Проверяем…" : "Войти"}
      </button>
    </form>
  );
}
