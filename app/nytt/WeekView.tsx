"use client";

import Link from "next/link";
import { useState } from "react";
import { DiscImage } from "@/components/DiscImage";
import { BADGE_STYLES } from "@/lib/badge-styles";
import type { SignalRow, StoreArrivalGroup, Week } from "@/lib/new-in-stores";
import { weekHeadline } from "@/lib/new-in-stores";

function SignalCard({ signal }: { signal: SignalRow }) {
  const badge = BADGE_STYLES[signal.type];
  const storeLabel =
    signal.storeCount === 1 ? signal.stores[0].storeName : `${signal.storeCount} butikker`;

  return (
    <Link
      href={`/disc/${signal.discId}/`}
      className="group flex flex-col rounded-2xl border-2 border-[#101C14] bg-white p-4 transition-transform duration-150 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0_#B8E04A]"
    >
      <div className="relative mb-3 flex items-center justify-center rounded-xl bg-[#F1EFE6]" style={{ height: 100 }}>
        <DiscImage src={signal.image} name={signal.name} brand={signal.brand} containerStyle={{ height: 100 }} />
        <div className="absolute left-2 top-2">
          <span
            className="dd-sticker text-[9px]"
            style={{ background: badge.bg, color: badge.text, boxShadow: "1.5px 1.5px 0 #101C14" }}
          >
            {badge.label}
          </span>
        </div>
      </div>
      <h3 className="truncate text-base font-extrabold text-[#101C14]">{signal.name}</h3>
      <p className="truncate text-xs text-[#101C1499]">
        {signal.brand}
        {signal.plastic ? ` · ${signal.plastic}` : ""}
      </p>
      <div className="mt-3 border-t-2 border-[#F1EFE6] pt-3">
        <p className="text-lg font-extrabold text-[#101C14]">fra kr {signal.price}</p>
        <p className="text-xs text-[#101C1499]">{storeLabel}</p>
      </div>
    </Link>
  );
}

function StoreArrivalRow({ group }: { group: StoreArrivalGroup }) {
  const [open, setOpen] = useState(false);
  const count = group.discs.length;

  return (
    <li className="border-b-2 border-[#101C14] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-sm font-bold text-[#101C14]">
          {group.storeName} fikk inn {count} kjent{count === 1 ? "" : "e"} disk{count === 1 ? "" : "er"}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#101C14"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="grid gap-2 pb-4 sm:grid-cols-2">
          {group.discs.map((d) => (
            <li key={d.discId}>
              <Link
                href={`/disc/${d.discId}/`}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#F1EFE6] px-3 py-2 text-sm hover:bg-[#101C14] hover:text-[#B8E04A]"
              >
                <span className="truncate">
                  <span className="font-semibold">{d.brand}</span> {d.name}
                </span>
                <span className="shrink-0 text-xs opacity-70">kr {d.price}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function formatDateRange(startDate: string, endDate: string): string {
  const fmt = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(d)}.${Number(m)}.`;
  };
  return `${fmt(startDate)}–${fmt(endDate)}`;
}

export function WeekView({
  week,
  weekIndex,
  isArchive,
}: {
  week: Week;
  weekIndex: { slug: string; weekNumber: number; year: number }[];
  isArchive: boolean;
}) {
  const otherWeeks = weekIndex.filter((w) => w.slug !== week.slug);

  return (
    <>
      {isArchive && (
        <p className="mb-6">
          <Link href="/nytt/" className="text-sm font-semibold text-[#101C1499] hover:text-[#101C14] hover:underline">
            ← Se siste uke
          </Link>
        </p>
      )}

      <h2 className="text-2xl font-extrabold text-[#101C14]">
        Uke {week.weekNumber} — {weekHeadline(week)}
      </h2>
      <p className="mt-1 text-sm text-[#101C1499]">{formatDateRange(week.startDate, week.endDate)}</p>

      {week.heroSignals.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {week.heroSignals.map((s) => (
            <SignalCard key={`${s.discId}-${s.type}`} signal={s} />
          ))}
        </div>
      )}

      {week.storeArrivals.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#101C1499]">
            Nytt i butikkutvalget
          </h3>
          <ul className="rounded-2xl border-2 border-[#101C14] bg-white px-4">
            {week.storeArrivals.map((g) => (
              <StoreArrivalRow key={g.store} group={g} />
            ))}
          </ul>
        </div>
      )}

      {week.heroSignals.length === 0 && week.storeArrivals.length === 0 && (
        <p className="mt-10 py-10 text-center text-sm text-[#101C1499]">
          Ingen nye disker fanget opp denne uken — sjekk igjen senere.
        </p>
      )}

      {otherWeeks.length > 0 && (
        <div className="mt-14 border-t-2 border-[#F1EFE6] pt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#101C1499]">
            Tidligere uker
          </h3>
          <div className="flex flex-wrap gap-2">
            {otherWeeks.map((w) => (
              <Link
                key={w.slug}
                href={`/nytt/${w.slug}/`}
                className="dd-selectable rounded-full bg-[#F1EFE6] px-4 py-2 text-sm font-semibold text-[#101C14]"
              >
                Uke {w.weekNumber} {w.year}
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
