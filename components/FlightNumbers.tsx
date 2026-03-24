import type { Disc } from "@/lib/disc-utils";

export function FlightNumbers({
  flight,
  className = "",
}: {
  flight: Disc["flight"];
  className?: string;
}) {
  const pairs: { label: string; value: number }[] = [
    { label: "S", value: flight.speed },
    { label: "G", value: flight.glide },
    { label: "T", value: flight.turn },
    { label: "F", value: flight.fade },
  ];
  return (
    <div
      className={`flex flex-wrap items-end text-foreground ${className || "mt-3"}`}
      aria-label={`Flight ${flight.speed} ${flight.glide} ${flight.turn} ${flight.fade}`}
    >
      {pairs.map((p, i) => (
        <span key={p.label} className="inline-flex items-end">
          {i > 0 ? (
            <span className="mx-2 select-none text-muted/45 sm:mx-2.5" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] font-medium uppercase leading-none tracking-wider text-muted">
              {p.label}
            </span>
            <span className="tabular-nums text-sm leading-tight">{p.value}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
