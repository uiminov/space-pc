"use client";

import { PartIcon } from "@/components/PartIcon";
import { ProductImage } from "@/components/ProductImage";

// Вариант «Фото-стек»: фото выбранного корпуса, а рядом карточками «падают» фото выбранных деталей.
export type SceneItem = { cat: string; label: string; name: string; image: string | null; id: number };

function Thumb({ it, className }: { it: { cat: string; image: string | null }; className: string }) {
  return (
    <ProductImage src={it.image} category={it.cat} className={`rounded-lg ${className}`} pad="p-0.5" iconClass="h-3/5 w-3/5" eager sizes="64px" />
  );
}

export function PhotoScene({
  items,
  caseItem,
  active,
  caseLabel,
  emptyCase,
  footer,
  onRemove,
  removeLabel,
}: {
  items: SceneItem[];
  caseItem: SceneItem | null;
  active: { cat: string; label: string } | null;
  caseLabel: string;
  emptyCase: string;
  footer: React.ReactNode;
  onRemove: (cat: string) => void;
  removeLabel: string;
}) {
  const removeBtn = (cat: string, name: string, cls: string) => (
    <button
      type="button"
      onClick={() => onRemove(cat)}
      className={`grid place-items-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger ${cls}`}
      aria-label={`${removeLabel}: ${name}`}
      title={removeLabel}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
  const caseBox = (
    <div
      key={`ring-${items.length}-${caseItem?.id ?? 0}`}
      className={`animate-ring relative flex aspect-square items-center justify-center overflow-hidden rounded-xl ${caseItem?.image ? "bg-studio" : "border border-dashed border-line-2 bg-surface-2"}`}
    >
      {caseItem?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={caseItem.id} src={caseItem.image} alt={caseItem.name} className="animate-drop absolute inset-0 mix-blend-multiply h-full w-full object-contain p-3" />
      ) : (
        <div className="flex flex-col items-center gap-2 p-3 text-center">
          <PartIcon category="case" className="h-10 w-10 lg:h-16 lg:w-16" glow={false} />
          <span className="hidden text-xs text-muted lg:block">{emptyCase}</span>
        </div>
      )}
      {caseItem ? removeBtn("case", caseItem.name, "absolute top-1.5 right-1.5 h-7 w-7 bg-bg/80 backdrop-blur") : null}
      {caseItem ? (
        <span className="absolute bottom-2 left-2 hidden max-w-[85%] truncate rounded-md bg-bg/80 px-2 py-0.5 text-[11px] backdrop-blur lg:block">
          {caseLabel}: {caseItem.name}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="card p-3 sm:p-5">
      {/* Телефон: корпус слева, справа итог и лента миниатюр */}
      <div className="flex gap-3 lg:hidden">
        <div className="w-28 shrink-0 sm:w-36">{caseBox}</div>
        <div className="min-w-0 flex-1">
          {footer}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {items.map((it) => (
              <span key={it.id} className="animate-drop relative">
                <Thumb it={it} className="h-9 w-9 border border-line" />
                {removeBtn(it.cat, it.name, "absolute -top-1.5 -right-1.5 h-5 w-5 border border-line bg-bg")}
              </span>
            ))}
            {active && active.cat !== "case" ? (
              <span className="flex h-9 w-9 animate-pulse items-center justify-center rounded-lg border border-dashed border-line-2 text-muted">+</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Компьютер: большое фото корпуса и стопка карточек деталей */}
      <div className="hidden lg:block">
        {caseBox}
        <ul className="mt-3 space-y-1.5">
          {items.map((it) => (
            <li key={it.id} className="animate-drop flex items-center gap-3 rounded-xl border border-line bg-bg/40 p-1.5 pr-1.5">
              <Thumb it={it} className="h-10 w-12" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] text-muted">{it.label}</span>
                <span className="block truncate text-[13px]">{it.name}</span>
              </span>
              {removeBtn(it.cat, it.name, "h-7 w-7 shrink-0")}
            </li>
          ))}
          {active && active.cat !== "case" ? (
            <li className="flex animate-pulse items-center gap-3 rounded-xl border border-dashed border-line-2 p-1.5 pr-3 text-muted">
              <span className="flex h-10 w-12 items-center justify-center rounded-lg bg-surface-2">
                <PartIcon category={active.cat} className="h-6 w-6" glow={false} />
              </span>
              <span className="text-[13px]">{active.label}…</span>
            </li>
          ) : null}
        </ul>
        <div className="mt-3 border-t border-line pt-3">{footer}</div>
      </div>
    </div>
  );
}
