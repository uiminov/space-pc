import { CATEGORY_ICONS } from "./categoryIcons";

// Неоновая иконка категории: контур цвета акцента с мягким свечением.
// Используется в плитках категорий и вместо фото у товаров без фото (на тёмной подложке).
export function PartIcon({ category, className = "h-6 w-6", glow = true }: { category: string; className?: string; glow?: boolean }) {
  const ic = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.case;
  const common = { fill: "none", stroke: "var(--accent)", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true" overflow="visible">
      <g style={glow ? { filter: "drop-shadow(0 0 3px rgb(var(--glow) / 0.45))" } : undefined}>
        <g {...common} strokeWidth={1.6}>
          {ic.body}
          {ic.line}
          {ic.accent}
        </g>
        <g {...common} strokeWidth={1} strokeOpacity={0.55}>
          {ic.detail}
        </g>
      </g>
    </svg>
  );
}
