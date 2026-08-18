import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import type { SignalRow } from "@/lib/new-in-stores";

const TYPE_LABEL: Record<string, string> = {
  distance: "distance driver",
  fairway: "fairway driver",
  midrange: "midrange",
  putter: "putter",
};

function DarkFlightBoxes({ flight }: { flight: { speed: number; glide: number; turn: number; fade: number } }) {
  const cells = [
    { label: "SPEED", value: flight.speed },
    { label: "GLIDE", value: flight.glide },
    { label: "TURN", value: flight.turn },
    { label: "FADE", value: flight.fade },
  ];
  return (
    <div className="mt-4 flex gap-1.5">
      {cells.map((c) => (
        <div key={c.label} className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-[#1E3D2F] py-2">
          <div className="text-lg font-extrabold text-[#FFFDF6]">
            {typeof c.value === "number" && c.value < 0 ? `−${Math.abs(c.value)}` : c.value}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-[#FFFDF677]">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

function NewDiscCard({ signal }: { signal: SignalRow }) {
  return (
    <Link
      href={`/disc/${signal.discId}/`}
      className="grid overflow-hidden rounded-[20px] border-2 border-[#101C14] bg-[#101C14] text-[#FFFDF6] shadow-[6px_6px_0_#B8E04A] md:grid-cols-[340px_1fr]"
    >
      <div className="flex items-center justify-center bg-[#1E3D2F] p-8">
        <div className="flex h-[170px] w-[170px] items-center justify-center rounded-full bg-[#FFFDF6]/[0.06] md:h-[224px] md:w-[224px]">
          <DiscImage src={signal.image} name={signal.name} brand={signal.brand} containerStyle={{ height: 130 }} />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-8 md:px-9">
        <span className="inline-flex w-fit -rotate-2 items-center rounded-[10px] bg-[#B8E04A] px-3 py-1.5 text-[13px] font-extrabold tracking-[0.1em] text-[#101C14] shadow-[2px_2px_0_#FFFDF6]">
          NY DISK
        </span>

        <div>
          <h3 className="text-[32px] font-extrabold tracking-[-0.035em] md:text-[44px]">{signal.name}</h3>
          <p className="mt-1 text-[17px] text-[#FFFDF6aa]">
            {signal.brand}
            {signal.plastic ? ` · ${signal.plastic}` : ""}
            {signal.discType ? ` · ${TYPE_LABEL[signal.discType] ?? signal.discType}` : ""}
          </p>
        </div>

        {signal.flight && <DarkFlightBoxes flight={signal.flight} />}

        <div className="mt-1 flex flex-col gap-4 border-t border-[#FFFDF6]/[0.16] pt-[18px] sm:flex-row sm:items-end sm:justify-between sm:gap-5">
          <div>
            <p className="text-[13px] text-[#FFFDF677]">Dukket opp hos</p>
            <p className="text-[16px] font-bold">
              {signal.stores.map((s) => s.storeName).join(", ")}
            </p>
          </div>
          <div className="flex items-end justify-between gap-4 sm:items-center">
            <div>
              <p className="text-[13px] text-[#FFFDF677]">{signal.hasShippingData ? "fra, inkl. frakt" : "fra"}</p>
              <p className="text-[30px] font-extrabold">kr {signal.price}</p>
            </div>
            <span className="dd-cta min-h-[48px] w-full px-6 shadow-[3px_3px_0_#FFFDF6] sm:w-auto">Se pris</span>
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
 */
export function NewDiscTier({ signals }: { signals: SignalRow[] }) {
  if (signals.length === 0) return null;

  return (
    <section className="border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[22px] font-extrabold text-[#101C14] md:text-[26px]">Ny disk</h2>
          <p className="text-[15px] text-[#101C1499]">Aldri sett i norsk butikk før denne uka.</p>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {signals.map((s) => (
            <NewDiscCard key={s.discId} signal={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
