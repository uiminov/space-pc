"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { autoFindImages, bulkAddFromPrice, resetImageChecks } from "../../actions";
import { categoryLabel } from "@/lib/catalog";

export function BulkTools({ withoutImage, unchecked }: { withoutImage: number; unchecked: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "add" | "img">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const add = async () => {
    setBusy("add");
    setMsg(null);
    try {
      const r = await bulkAddFromPrice();
      setMsg(
        r.added
          ? `Добавлено ${r.added}: ${Object.entries(r.byCategory).map(([k, v]) => `${categoryLabel(k).toLowerCase()} — ${v}`).join(", ")}. Теперь подберите фото.`
          : "Новых комплектующих в прайсе нет — всё уже добавлено.",
      );
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const images = async () => {
    setBusy("img");
    let found = 0;
    let processed = 0;
    const sources: Record<string, number> = {};
    try {
      for (let guard = 0; guard < 500; guard++) {
        const r = await autoFindImages();
        found += r.found;
        processed += r.processed;
        for (const [k, v] of Object.entries(r.sources)) sources[k] = (sources[k] || 0) + v;
        setMsg(`Проверено ${processed}, найдено фото: ${found}. Осталось ${r.remaining}…`);
        if (!r.remaining || !r.processed) break;
      }
      setMsg(
        `Готово: проверено ${processed}, найдено фото ${found}` +
          (found ? ` (${Object.entries(sources).map(([k, v]) => `${k}: ${v}`).join(", ")})` : "") +
          ". Для остальных загрузите фото вручную в карточке.",
      );
      router.refresh();
    } catch (e) {
      setMsg(`Ошибка: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-2">
        <button className="btn-ghost" disabled={!!busy} onClick={add}>
          {busy === "add" ? "Добавляем…" : "+ Добавить все комплектующие из прайса"}
        </button>
        <button className="btn-ghost" disabled={!!busy || !unchecked} onClick={images}>
          {busy === "img" ? "Ищем фото…" : `Подобрать фото автоматически (${unchecked})`}
        </button>
        {withoutImage > unchecked ? (
          <button
            className="text-xs text-muted hover:text-text"
            disabled={!!busy}
            onClick={async () => {
              await resetImageChecks();
              router.refresh();
            }}
          >
            искать снова для всех без фото ({withoutImage})
          </button>
        ) : null}
      </div>
      {msg ? <p className="text-sm text-muted">{msg}</p> : null}
    </div>
  );
}
