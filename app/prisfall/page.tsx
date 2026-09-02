"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DiscImage } from "@/components/DiscImage";
import { PriceAlertInline } from "@/components/PriceAlertInline";
import {
  getPriceDropGroups,
  getWeekStats,
  dropRowWeekdayLabel,
  hasPriceDropsData,
  type PriceDropRow,
} from "@/lib/price-drops";
import { storesLabel } from "@/lib/pluralize";

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
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={open ? "#B8E04A" : "#101C14"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    </button>
  );
}

/**
 * Today's group. Two genuinely different layouts, not one responsive one —
 * mobile is a single tappable row (thumbnail · name/brand/price-line ·
 * badge+price+"Se pris"), desktop keeps the larger row with the alert bell.
 * Confirmed in production 2026-09-02: the old flex-col-on-mobile layout
 * stacked every element (rank, image, name, sparkline all full-width), so
 * one drop consumed a full screen; mobile drops the sparkline and the bell
 * (rank sits as a small badge over the thumbnail instead of its own column)
 * to keep the row compact and the tap target unambiguous.
 */
function PriceDropListRow({ row, rank }: { row: PriceDropRow; rank: number }) {
  const [alertOpen, setAlertOpen] = useState(false);
  const alertDiscs = [{ discId: row.discId, name: row.name, brand: row.brand, newPrice: row.newPrice }];

  return (
    <li className="border-b-2 border-[#101C14] last:border-b-0">
      {/* Mobile compact row */}
      <Link href={`/disc/${row.discId}`} className="flex items-center gap-2.5 py-2.5 sm:hidden">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F1EFE6]">
          <DiscImage src={row.image ?? ""} name={row.name} brand={row.brand} type={row.type} fit="cover" />
          <span className="absolute -left-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#FFFDF6] bg-[#101C14] text-[9px] font-extrabold text-[#FFFDF6]">
            {rank}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-[#101C14]">{row.name}</h3>
          <p className="truncate text-xs text-[#101C1499]">{row.brand}</p>
          <p className="truncate text-[10px] text-[#101C1477]">
            <span className="line-through">{row.oldPrice} kr</span> · inkl. frakt · {row.storeName}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <span className="inline-flex w-fit -rotate-2 items-center rounded-lg bg-[#B8E04A] px-[7px] py-[3px] text-[11px] font-extrabold text-[#101C14] shadow-[1.5px_1.5px_0_#101C14]">
              −{Math.abs(row.pct)} %
            </span>
            <span className="text-[15px] font-extrabold text-[#101C14]">{row.newPrice},-</span>
          </div>
          <span className="dd-cta px-2.5 py-1 text-[11px]">Se pris</span>
        </div>
      </Link>

      {/* Desktop — unchanged full row with sparkline */}
      <div className="hidden py-5 sm:flex sm:items-center sm:gap-4">
        <span className="w-8 shrink-0 text-xl font-extrabold text-[#101C1477]">
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
        <div className="pb-4 sm:pb-5">
          <PriceAlertInline discs={alertDiscs} />
        </div>
      )}
    </li>
  );
}

/** Older groups — compact row: no sparkline, no alert bell, smaller image. Optional weekday label for "Tidligere denne uka", which can span several distinct days. */
function CompactPriceDropRow({ row, showWeekday }: { row: PriceDropRow; showWeekday: boolean }) {
  return (
    <li className="border-b-2 border-[#101C14] last:border-b-0">
      <Link href={`/disc/${row.discId}`} className="flex items-center gap-3 py-3 hover:bg-[#F1EFE6]/40">
        {showWeekday && (
          <span className="w-16 shrink-0 text-xs font-extrabold uppercase tracking-[0.06em] text-[#101C1477]">
            {dropRowWeekdayLabel(row.date)}
          </span>
        )}

        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[#F1EFE6]">
          <DiscImage src={row.image ?? ""} name={row.name} brand={row.brand} type={row.type} fit="cover" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-[#101C14]">{row.name}</h3>
          <p className="truncate text-xs text-[#101C1499]">
            {row.brand}{row.plastic ? ` · ${row.plastic}` : ""} · {row.storeName}
          </p>
        </div>

        <span className="shrink-0 rounded-lg bg-[#F1EFE6] px-2 py-1 text-xs font-extrabold text-[#101C14]">
          −{Math.abs(row.pct)} %
        </span>

        <div className="shrink-0 text-right">
          <span className="text-xs text-[#101C1477] line-through">{row.oldPrice}</span>{" "}
          <span className="text-sm font-extrabold text-[#101C14]">{row.newPrice},-</span>
        </div>
      </Link>
    </li>
  );
}

export default function PrisfallPage() {
  const groups = getPriceDropGroups();
  const weekStats = getWeekStats();

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
            {weekStats && (
              <p className="mt-4 text-sm font-bold text-[#101C14]">
                Denne uka: {weekStats.count} prisfall · største −{Math.abs(weekStats.biggestPct)} % · {weekStats.storeCount} {storesLabel(weekStats.storeCount)}
              </p>
            )}
          </div>
        </section>

        <section className="w-full bg-[#FFFDF6] px-5 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-4xl">
            {!hasPriceDropsData || groups.length === 0 ? (
              <p className="py-10 text-center text-sm text-[#101C1499]">
                Ingen store prisfall akkurat nå — sjekk igjen senere.
              </p>
            ) : (
              <div className="flex flex-col gap-10">
                {groups.map((group) => (
                  <div key={group.bucket}>
                    <h2 className="mb-1 text-lg font-extrabold tracking-tight text-[#101C14]">{group.label}</h2>
                    {group.bucket === "today" ? (
                      <ul>
                        {group.rows.map((row, i) => (
                          <PriceDropListRow key={row.discId} row={row} rank={i + 1} />
                        ))}
                      </ul>
                    ) : (
                      <ul>
                        {group.rows.map((row) => (
                          <CompactPriceDropRow key={row.discId} row={row} showWeekday={group.bucket === "earlier-this-week"} />
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-10 max-w-[70ch] text-xs leading-relaxed text-[#101C1477]">
              Prisene er totalpris levert, basert på våre egne målinger, ikke butikkenes «førpris». Et prisfall
              telles kun når det er en ny bunnotering de siste 7 dagene, ikke bare lavere enn dagen før.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
