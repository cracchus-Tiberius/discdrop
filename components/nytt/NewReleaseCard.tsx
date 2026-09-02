import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import type { SignalRow } from "@/lib/new-in-stores";
import { weekdayLabel } from "@/lib/new-in-stores";
import { storesLabel } from "@/lib/pluralize";

function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function ReleaseCard({ signal }: { signal: SignalRow }) {
  const [primaryStore, ...otherStores] = signal.stores;

  return (
    <Link
      href={`/disc/${signal.discId}/`}
      className="group flex flex-col overflow-hidden rounded-[20px] border-2 border-[#101C14] bg-white shadow-[5px_5px_0_#B8E04A] transition-transform duration-150 ease-out hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_#B8E04A]"
    >
      <div className="relative flex h-[150px] items-center justify-center border-b-2 border-[#101C14] bg-[#F1EFE6] md:h-[200px]">
        <div className="flex h-full max-w-[82%] items-center justify-center">
          <DiscImage src={signal.image} name={signal.name} brand={signal.brand} containerStyle={{ height: 130 }} />
        </div>
        <span className="absolute left-3.5 top-3.5 -rotate-2 rounded-lg bg-[#101C14] px-2.5 py-[5px] text-[11px] font-extrabold tracking-[0.1em] text-[#B8E04A] shadow-[2px_2px_0_#B8E04A]">
          NY DROP
        </span>
        <span className="absolute right-3.5 top-3.5 text-[11px] font-extrabold tracking-[0.1em] text-[#101C1477]">
          {weekdayLabel(signal.firstSeenMs)}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3.5 px-5 pb-5 pt-[18px]">
        <div>
          <h3 className="text-[24px] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#101C14] md:text-[28px]">
            {signal.name}
          </h3>
          <p className="text-[15px] text-[#101C1499]">
            {signal.brand}
            {signal.plastic ? ` · ${signal.plastic}` : ""}
            {signal.edition ? ` · ${signal.edition}` : ""}
          </p>
        </div>

        {primaryStore && (
          <div className="flex items-center gap-2">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border-2 border-[#101C14] bg-[#F1EFE6] text-[10px] font-extrabold text-[#101C14]">
              {storeInitials(primaryStore.storeName)}
            </span>
            <span className="text-sm font-bold text-[#101C14]">{primaryStore.storeName}</span>
            {otherStores.length > 0 && (
              <span className="text-[13px] text-[#101C1477]">
                + {otherStores.length} {storesLabel(otherStores.length)}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 border-t-2 border-[#F1EFE6] pt-3.5">
          <div>
            <p className="text-[11px] text-[#101C1477]">{signal.hasShippingData ? "fra, inkl. frakt" : "fra"}</p>
            <p className="text-2xl font-extrabold text-[#101C14]">kr {signal.price}</p>
          </div>
          <span className="dd-cta px-4 py-2 text-sm">Se disk →</span>
        </div>
      </div>
    </Link>
  );
}

/**
 * "Ny drop" — kjent form, ny plast eller et nytt stempel (Tour Series,
 * spillerstempel, turneringsutgave, årsmerket opplag). Auto-fit grid so
 * 1–10 cards all read as intentional: 2 cards widen instead of leaving a
 * gap, 3 fill the row, 4+ wrap. Do NOT switch this to a fixed lg:grid-cols-3.
 */
export function NewReleases({ signals }: { signals: SignalRow[] }) {
  if (signals.length === 0) return null;

  return (
    <section className="border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-[22px] font-extrabold text-[#101C14] md:text-[26px]">Nye drops</h2>
            <p className="text-[15px] text-[#101C1499] md:hidden">{signals.length} denne uka</p>
            <p className="hidden text-[15px] text-[#101C1499] md:block">Kjent form, ny plast eller nytt stempel.</p>
          </div>
          <p className="hidden text-sm font-bold text-[#101C1499] md:block">{signals.length} denne uka</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 md:[grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
          {signals.map((s) => (
            <ReleaseCard key={s.discId} signal={s} />
          ))}
        </div>
      </div>
    </section>
  );
}
