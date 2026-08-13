"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DiscImage } from "@/components/DiscImage";
import { PriceSparkline } from "@/components/PriceSparkline";
import { PriceAlertInline } from "@/components/PriceAlertInline";
import {
  getPriceDropRows,
  hasPriceDropsData,
  type PriceChangePeriod,
  type PriceDropRow,
} from "@/lib/price-drops";

function BellButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={open}
      aria-label="Sett prisvarsel for denne disken"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#101C14] transition-colors ${
        open ? "bg-[#101C14]" : "bg-white hover:bg-[#F1EFE6]"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open ? "#B8E04A" : "#101C14"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    </button>
  );
}

function PriceDropListRow({ row, rank }: { row: PriceDropRow; rank: number }) {
  const [alertOpen, setAlertOpen] = useState(false);

  return (
    <li className="border-b-2 border-[#101C14] last:border-b-0">
      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center">
        <span className="w-8 shrink-0 text-lg font-extrabold text-[#101C1477] sm:text-xl">
          {rank}
        </span>

        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F1EFE6]">
          <DiscImage src={row.image ?? ""} name={row.name} brand={row.brand} type={row.type} fit="cover" />
        </div>

        <div className="min-w-0 flex-1">
          <Link href={`/disc/${row.discId}`} className="block">
            <h3 className="truncate text-base font-extrabold text-[#101C14] hover:underline">{row.name}</h3>
            <p className="text-sm text-[#101C1499]">
              {row.brand}{row.plastic ? ` · ${row.plastic}` : ""}
            </p>
          </Link>
        </div>

        <div className="w-full max-w-[220px] shrink-0 sm:w-[200px]">
          <PriceSparkline history={row.history} />
        </div>

        <span className="inline-flex w-fit shrink-0 -rotate-2 items-center rounded-[10px] bg-[#B8E04A] px-[11px] py-[5px] text-[15px] font-extrabold text-[#101C14] shadow-[2px_2px_0_#101C14]">
          −{Math.abs(row.pct)} %
        </span>

        <div className="shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-2">
            <span className="text-sm text-[#101C1477] line-through">{row.oldPrice} kr</span>
            <span className="text-xl font-extrabold text-[#101C14]">{row.newPrice},-</span>
          </div>
          <p className="text-[11px] text-[#101C1499]">inkl. frakt · {row.storeName}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <BellButton open={alertOpen} onClick={() => setAlertOpen((v) => !v)} />
          <Link href={`/disc/${row.discId}`} className="dd-cta px-4 py-2 text-sm">
            Se pris
          </Link>
        </div>
      </div>

      {alertOpen && (
        <div className="pb-5">
          <PriceAlertInline discs={[{ discId: row.discId, name: row.name, brand: row.brand, newPrice: row.newPrice }]} />
        </div>
      )}
    </li>
  );
}

export default function PrisfallPage() {
  const [period, setPeriod] = useState<PriceChangePeriod>("day");

  const dayRows = useMemo(() => getPriceDropRows("day"), []);
  const weekRows = useMemo(() => getPriceDropRows("week"), []);
  const rows = period === "day" ? dayRows : weekRows;

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />
      <main>
        <section className="w-full border-b-2 border-[#101C14] bg-[#FFFDF6] px-5 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#101C14] md:text-4xl">Prisfall</h1>
            <p className="mt-3 max-w-[60ch] text-base text-[#101C1499]">
              De største priskuttene vi har fanget opp, rangert fra størst til minst. Totalpris inkludert frakt.
            </p>

            <div className="mt-6 flex gap-[3px] rounded-full bg-[#F1EFE6] p-1 sm:w-fit">
              {(["day", "week"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`min-h-[44px] flex-1 rounded-full px-5 text-sm font-extrabold transition-colors sm:flex-none ${
                    period === p ? "bg-[#101C14] text-[#B8E04A]" : "bg-transparent text-[#101C1499]"
                  }`}
                >
                  {p === "day" ? "I dag" : "Denne uka"}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full bg-[#FFFDF6] px-5 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            {!hasPriceDropsData || rows.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#101C1499]">
                Ingen store prisfall i denne perioden akkurat nå — sjekk igjen senere.
              </p>
            ) : (
              <ul>
                {rows.map((row, i) => (
                  <PriceDropListRow key={`${row.discId}-${period}`} row={row} rank={i + 1} />
                ))}
              </ul>
            )}

            <p className="mt-10 max-w-[70ch] text-xs leading-relaxed text-[#101C1477]">
              Prisene er totalpris levert. Grafene bygger på våre egne målinger, ikke butikkenes «førpris».
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
