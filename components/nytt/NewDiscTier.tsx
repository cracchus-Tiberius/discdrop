import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import { FlightBoxes } from "@/components/FlightBoxes";
import type { SignalRow } from "@/lib/new-in-stores";

const TYPE_LABEL: Record<string, string> = {
  distance: "distance driver",
  fairway: "fairway driver",
  midrange: "midrange",
  putter: "putter",
};

/** "12 · 5 · −1 · 3" — the 2+ card layout's compact stand-in for the full 4-box FlightBoxes grid, which doesn't fit at reduced card width. */
function CompactFlightRow({ flight }: { flight: { speed: number; glide: number; turn: number; fade: number } }) {
  const values = [flight.speed, flight.glide, flight.turn, flight.fade].map((v) => (v < 0 ? `−${Math.abs(v)}` : `${v}`));
  return <p className="text-sm font-bold text-[#101C1499]">{values.join(" · ")}</p>;
}

function NewDiscCard({ signal, compact }: { signal: SignalRow; compact: boolean }) {
  return (
    <Link
      href={`/disc/${signal.discId}/`}
      className={`grid overflow-hidden rounded-[20px] border-2 border-[#101C14] bg-white shadow-[5px_5px_0_#B8E04A] ${
        compact ? "md:grid-cols-[150px_1fr]" : "md:grid-cols-[230px_1fr]"
      }`}
    >
      <div
        className={`flex shrink-0 items-center justify-center border-b-2 border-[#101C14] bg-[#F1EFE6] p-5 md:border-b-0 md:border-r-2 ${
          compact ? "h-[120px] md:h-auto" : "h-[150px] md:h-auto"
        }`}
      >
        <div
          className={`flex items-center justify-center rounded-full border-2 border-[#101C14] bg-[#FFFDF6] ${
            compact ? "h-[90px] w-[90px]" : "h-[150px] w-[150px]"
          }`}
        >
          <DiscImage src={signal.image} name={signal.name} brand={signal.brand} containerStyle={{ height: compact ? 65 : 110 }} />
        </div>
      </div>

      <div className={`flex flex-col gap-[11px] ${compact ? "px-5 py-4" : "px-6 py-5"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="inline-flex w-fit -rotate-2 items-center rounded-[9px] bg-[#B8E04A] px-[11px] py-[5px] text-xs font-extrabold tracking-[0.1em] text-[#101C14] shadow-[2px_2px_0_#101C14]">
            NY DISK
          </span>
          {!compact && signal.flight && <FlightBoxes flight={signal.flight} labels="full" size="lg" />}
        </div>

        <div>
          <h3 className={`font-extrabold tracking-[-0.035em] text-[#101C14] ${compact ? "text-[22px]" : "text-[30px]"}`}>
            {signal.name}
          </h3>
          <p className="text-[15px] text-[#101C1499]">
            {signal.brand}
            {signal.plastic ? ` · ${signal.plastic}` : ""}
            {!compact && signal.discType ? ` · ${TYPE_LABEL[signal.discType] ?? signal.discType}` : ""}
          </p>
        </div>

        {compact && signal.flight && <CompactFlightRow flight={signal.flight} />}

        {signal.description && (
          <p
            className={`leading-[1.55] text-[#101C14]/70 ${compact ? "text-sm [-webkit-line-clamp:2] [display:-webkit-box] [-webkit-box-orient:vertical] overflow-hidden" : "max-w-[64ch] text-[15px]"}`}
          >
            {signal.description}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3 border-t-2 border-[#F1EFE6] pt-3.5 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs text-[#101C1477]">Dukket opp hos</p>
            <p className="text-[15px] font-bold text-[#101C14]">{signal.stores.map((s) => s.storeName).join(", ")}</p>
          </div>
          <div className="flex items-end justify-between gap-3.5 sm:items-center">
            <div>
              <p className="text-[11px] text-[#101C1477]">{signal.hasShippingData ? "fra, inkl. frakt" : "fra"}</p>
              <p className={`font-extrabold text-[#101C14] ${compact ? "text-xl" : "text-2xl"}`}>{signal.price},-</p>
            </div>
            <span className="dd-cta min-h-[44px] px-5 text-sm">Se disk →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * "Ny disk" tier — reserved for discs never seen in a Norwegian/Nordic store
 * we scrape before this week. Renders NOTHING when empty (no placeholder,
 * no "coming soon" box) — per design_handoff_nytt/README.md, this is a
 * decision not to change without asking. The signal type has existed in the
 * pipeline since day one specifically so this just starts rendering the
 * moment real data appears, with no code change needed here.
 *
 * Layout by count, per spec: exactly one -> the full-width spotlight card;
 * two or more -> a 2-column grid of the same card at reduced size (smaller
 * image well, compact single-row flight numbers instead of the 4-box grid,
 * 2-line-clamped description) so the tier never looks over-dimensioned for
 * a busy week.
 */
export function NewDiscTier({ signals }: { signals: SignalRow[] }) {
  if (signals.length === 0) return null;
  const compact = signals.length > 1;

  return (
    <section className="border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[22px] font-extrabold text-[#101C14] md:text-[26px]">Ny disk</h2>
          <p className="text-[15px] text-[#101C1499]">Aldri sett i norsk butikk før denne uka.</p>
        </div>

        <div className={compact ? "mt-6 grid grid-cols-1 gap-5 md:grid-cols-2" : "mt-6 flex flex-col gap-5"}>
          {signals.map((s) => (
            <NewDiscCard key={s.discId} signal={s} compact={compact} />
          ))}
        </div>
      </div>
    </section>
  );
}
