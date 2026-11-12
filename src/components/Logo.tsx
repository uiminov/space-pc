import { useId } from "react";

// Логотип SPACE PC «Сатурн»: одноцветный знак (currentColor) — планета и кольцо.
// Там, где кольцо проходит перед планетой, в планете вырезана прорезь, поэтому
// знак без полутонов и одинаково читается на чёрном, белом и в печати в одну краску.
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <clipPath id={`${id}-front`}>
          <rect x="-10" y="20" width="60" height="30" />
        </clipPath>
        <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
          <rect width="40" height="40" fill="#fff" />
          <g transform="rotate(-20 20 20)">
            <ellipse cx="20" cy="20" rx="17" ry="6" fill="none" stroke="#000" strokeWidth="6.4" clipPath={`url(#${id}-front)`} />
          </g>
        </mask>
      </defs>
      <circle cx="20" cy="20" r="10.5" fill="currentColor" mask={`url(#${id}-cut)`} />
      <ellipse cx="20" cy="20" rx="17" ry="6" transform="rotate(-20 20 20)" fill="none" stroke="currentColor" strokeWidth="2.6" />
    </svg>
  );
}

export function Logo({ name = "SPACE PC", className = "" }: { name?: string; className?: string }) {
  // «SPACE PC» → «SPACE» + «PC» светлее; любое другое название из настроек показывается как есть
  const m = name.trim().match(/^(.*?)\s*(PC)$/i);
  return (
    <span className={`inline-flex items-center gap-2 text-text sm:gap-2.5 ${className}`}>
      <LogoMark className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" />
      <span className="font-display text-[15px] leading-none font-semibold tracking-[0.02em] whitespace-nowrap sm:text-lg sm:tracking-[0.04em]">
        {m ? (
          <>
            {m[1]}
            <span className="font-medium text-muted"> {m[2].toUpperCase()}</span>
          </>
        ) : (
          name
        )}
      </span>
    </span>
  );
}
