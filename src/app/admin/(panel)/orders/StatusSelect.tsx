"use client";

import { ORDER_STATUSES } from "@/lib/catalog";

export function StatusSelect({ id, status, action }: { id: number; status: string; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label className="label">Статус</label>
      <select name="status" defaultValue={status} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="input">
        {ORDER_STATUSES.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
    </form>
  );
}
