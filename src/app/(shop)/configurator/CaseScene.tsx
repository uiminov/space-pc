"use client";

// Рисованный корпус в разрезе: выбранные детали «влетают» на свои места.
// Деталь текущего шага подсвечивается пунктиром — видно, куда она встанет.
type Props = { has: Record<string, boolean>; active?: string };

const FROM: Record<string, string> = {
  mb: "translate(-40px, 0)",
  cpu: "translate(0, -60px)",
  cooler: "translate(0, -80px)",
  ram: "translate(60px, -30px)",
  gpu: "translate(-90px, 20px)",
  ssd: "translate(70px, 0)",
  hdd: "translate(70px, 40px)",
  psu: "translate(-80px, 40px)",
};

function Part({ id, on, children }: { id: string; on: boolean; children: React.ReactNode }) {
  return (
    <g
      style={{
        transform: on ? "none" : FROM[id],
        opacity: on ? 1 : 0,
        transition: "transform 650ms cubic-bezier(.2,.9,.25,1.15), opacity 400ms ease",
      }}
    >
      {children}
    </g>
  );
}

function Slot({ id, active, children }: { id: string; active?: string; children: React.ReactNode }) {
  if (active !== id) return null;
  return (
    <g className="animate-pulse" fill="none" stroke="var(--text)" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7">
      {children}
    </g>
  );
}

export function CaseScene({ has, active }: Props) {
  const line = "var(--muted)";
  const body = "var(--surface-2)";
  const ink = "var(--text)";
  return (
    <svg viewBox="0 0 300 340" className="h-full w-full" role="img" aria-label="PC">
      {/* корпус */}
      <rect x="20" y="10" width="260" height="320" rx="14" fill="var(--surface)" stroke={has.case ? ink : line} strokeWidth={has.case ? 2.5 : 1.5} strokeDasharray={has.case ? undefined : "6 5"} />
      <rect x="32" y="22" width="236" height="296" rx="8" fill="none" stroke="var(--line-2)" />
      {has.case ? (
        <g opacity="0.9">
          {[60, 120, 180].map((y) => (
            <circle key={y} cx="252" cy={y} r="13" fill="none" stroke={line} strokeWidth="1.5" />
          ))}
        </g>
      ) : null}
      {/* кожух блока питания */}
      <line x1="32" y1="262" x2="268" y2="262" stroke="var(--line-2)" />

      {/* бледный контур платы, пока она не выбрана */}
      {!has.mb ? <rect x="52" y="34" width="170" height="200" rx="6" fill="none" stroke="var(--line-2)" strokeDasharray="4 4" /> : null}

      {/* места деталей текущего шага */}
      <Slot id="mb" active={active}><rect x="52" y="34" width="170" height="200" rx="6" /></Slot>
      <Slot id="cpu" active={active}><rect x="112" y="70" width="40" height="40" rx="4" /></Slot>
      <Slot id="cooler" active={active}><circle cx="132" cy="90" r="30" /></Slot>
      <Slot id="ram" active={active}><rect x="168" y="58" width="22" height="66" rx="3" /></Slot>
      <Slot id="gpu" active={active}><rect x="58" y="168" width="176" height="30" rx="5" /></Slot>
      <Slot id="ssd" active={active}><rect x="96" y="140" width="64" height="10" rx="2" /></Slot>
      <Slot id="hdd" active={active}><rect x="190" y="272" width="66" height="40" rx="4" /></Slot>
      <Slot id="psu" active={active}><rect x="44" y="272" width="120" height="40" rx="4" /></Slot>

      {/* материнская плата */}
      <Part id="mb" on={!!has.mb}>
        <rect x="52" y="34" width="170" height="200" rx="6" fill={body} stroke={line} strokeWidth="1.5" />
        <rect x="58" y="40" width="22" height="60" rx="2" fill="none" stroke="var(--line-2)" />
        <rect x="66" y="210" width="140" height="6" rx="2" fill="var(--line-2)" />
        <rect x="66" y="160" width="140" height="5" rx="2" fill="var(--line-2)" />
        <rect x="196" y="140" width="18" height="18" rx="2" fill="none" stroke="var(--line-2)" />
      </Part>
      {/* процессор */}
      <Part id="cpu" on={!!has.cpu}>
        <rect x="112" y="70" width="40" height="40" rx="4" fill={ink} />
        <rect x="120" y="78" width="24" height="24" rx="2" fill="none" stroke={body} strokeWidth="1.5" />
      </Part>
      {/* память */}
      <Part id="ram" on={!!has.ram}>
        <rect x="170" y="58" width="7" height="66" rx="2" fill={ink} />
        <rect x="181" y="58" width="7" height="66" rx="2" fill={ink} />
      </Part>
      {/* SSD M.2 */}
      <Part id="ssd" on={!!has.ssd}>
        <rect x="96" y="140" width="64" height="10" rx="2" fill={line} />
        <rect x="100" y="142" width="14" height="6" rx="1" fill={ink} />
      </Part>
      {/* кулер поверх процессора */}
      <Part id="cooler" on={!!has.cooler}>
        <circle cx="132" cy="90" r="30" fill={body} stroke={ink} strokeWidth="2" />
        <circle cx="132" cy="90" r="6" fill={ink} />
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} d="M132 90 q10 -8 4 -22" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" transform={`rotate(${a} 132 90)`} />
        ))}
      </Part>
      {/* видеокарта */}
      <Part id="gpu" on={!!has.gpu}>
        <rect x="58" y="168" width="176" height="30" rx="5" fill={ink} />
        {[96, 146, 196].map((x) => (
          <g key={x}>
            <circle cx={x} cy="183" r="11" fill={body} />
            <circle cx={x} cy="183" r="3" fill={ink} />
          </g>
        ))}
      </Part>
      {/* блок питания */}
      <Part id="psu" on={!!has.psu}>
        <rect x="44" y="272" width="120" height="40" rx="4" fill={line} />
        <circle cx="104" cy="292" r="13" fill="none" stroke={body} strokeWidth="2" />
      </Part>
      {/* жёсткий диск */}
      <Part id="hdd" on={!!has.hdd}>
        <rect x="190" y="272" width="66" height="40" rx="4" fill={body} stroke={line} strokeWidth="1.5" />
        <circle cx="223" cy="292" r="10" fill="none" stroke={line} />
      </Part>
    </svg>
  );
}
