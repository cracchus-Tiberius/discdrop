// components/PriceSparkline.tsx — pure SVG price-history sparkline for the
// Prisfall feature. No chart library: a 7-day history array is small and
// fixed-shape enough that a hand-rolled polyline is simpler and lighter.
// Design spec: Claude Design project "DiscDrop Redesign",
// design_handoff_prisfall/README.md, "Skjerm 2" sparkline section.

const VIEW_WIDTH = 240;
const VIEW_HEIGHT = 40;
const X_START = 6;
const X_END = 234;
const Y_TOP = 6;
const Y_BOTTOM = 34;

export function PriceSparkline({ history }: { history: number[] }) {
  if (!history || history.length < 2) return null;

  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min || 1;

  const points = history.map((v, i) => {
    const x = X_START + (i / (history.length - 1)) * (X_END - X_START);
    const y = Y_BOTTOM - ((v - min) / range) * (Y_BOTTOM - Y_TOP);
    return { x, y };
  });

  const last = points[points.length - 1];

  return (
    <div className="rounded-xl bg-[#F1EFE6] px-[11px] pb-[7px] pt-[9px]">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} width="100%" height={36} preserveAspectRatio="none" aria-hidden>
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="#101C14"
          strokeOpacity={0.4}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={last.x} cy={last.y} r={5} fill="#B8E04A" stroke="#101C14" strokeWidth={2} />
      </svg>
      <div className="flex justify-between text-[9px] font-semibold tracking-[0.08em] text-[#101C1488]">
        <span>7 DAGER SIDEN</span>
        <span>I DAG</span>
      </div>
    </div>
  );
}
