// Стилизованная иллюстрация корпуса — используется, пока у сборки нет фото.
export function PcArt({ seed = 0, className = "" }: { seed?: number; className?: string }) {
  const hues = [78, 190, 280, 25, 140, 330];
  const h = hues[seed % hues.length];
  const glow = `hsl(${h} 100% 60%)`;
  const id = `g${seed}`;
  return (
    <svg viewBox="0 0 320 240" className={className} aria-hidden="true">
      <defs>
        <radialGradient id={`${id}r`} cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor={glow} stopOpacity="0.35" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}f`} x1="0" x2="1">
          <stop offset="0%" stopColor="#1b1f25" />
          <stop offset="100%" stopColor="#0f1115" />
        </linearGradient>
      </defs>
      <rect width="320" height="240" fill={`url(#${id}r)`} />
      {/* корпус */}
      <rect x="95" y="28" width="130" height="190" rx="10" fill={`url(#${id}f)`} stroke="#2f343c" />
      {/* стекло */}
      <rect x="105" y="40" width="88" height="166" rx="5" fill="#0b0d10" stroke="#262a31" />
      {/* видеокарта */}
      <rect x="112" y="118" width="74" height="16" rx="3" fill="#1c2027" stroke={glow} strokeOpacity="0.7" />
      <line x1="114" y1="126" x2="184" y2="126" stroke={glow} strokeOpacity="0.9" strokeWidth="1.5" />
      {/* кулер процессора */}
      <circle cx="142" cy="78" r="15" fill="#14171c" stroke="#3a3f48" />
      <circle cx="142" cy="78" r="9" fill="none" stroke={glow} strokeOpacity="0.8" strokeWidth="2" />
      {/* память */}
      <rect x="165" y="60" width="4" height="34" rx="1" fill={glow} fillOpacity="0.85" />
      <rect x="172" y="60" width="4" height="34" rx="1" fill={glow} fillOpacity="0.85" />
      {/* вентиляторы на передней панели */}
      {[62, 112, 162].map((y) => (
        <g key={y}>
          <circle cx="209" cy={y} r="11" fill="#0b0d10" stroke={glow} strokeOpacity="0.9" strokeWidth="2" />
          <circle cx="209" cy={y} r="3" fill="#2a2f37" />
        </g>
      ))}
      {/* БП */}
      <rect x="105" y="176" width="88" height="30" rx="3" fill="#13161a" stroke="#262a31" />
      <rect x="128" y="218" width="64" height="6" rx="3" fill="#000" opacity="0.5" />
    </svg>
  );
}
