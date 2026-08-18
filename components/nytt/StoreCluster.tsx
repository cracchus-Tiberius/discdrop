"use client";

import { useState } from "react";
import Link from "next/link";
import { DiscImage } from "@/components/DiscImage";
import type { StoreArrivalGroup } from "@/lib/new-in-stores";

function storeInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const THUMB_LIMIT_DESKTOP = 4;
const THUMB_LIMIT_MOBILE = 2;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Cluster({ group, defaultOpen }: { group: StoreArrivalGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const count = group.discs.length;
  const panelId = `cluster-${group.store}`;
  const overflowDesktop = Math.max(0, count - THUMB_LIMIT_DESKTOP);
  const overflowMobile = Math.max(0, count - THUMB_LIMIT_MOBILE);

  return (
    <div className="mb-4 break-inside-avoid overflow-hidden rounded-[18px] border-2 border-[#101C14] bg-white shadow-[4px_4px_0_#101C14]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-[56px] w-full items-center gap-3.5 px-[18px] py-4 text-left"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#101C14] bg-[#B8E04A] text-[14px] font-extrabold text-[#101C14] md:h-11 md:w-11 md:text-[15px]">
          {storeInitials(group.storeName)}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-extrabold text-[#101C14]">{group.storeName}</span>
          <span className="block text-[13px] text-[#101C1499]">
            {count} kjent{count === 1 ? "" : "e"} disk{count === 1 ? "" : "er"} inn denne uka
          </span>
        </span>

        <span className="hidden shrink-0 items-center sm:flex">
          {group.discs.slice(0, THUMB_LIMIT_DESKTOP).map((d, i) => (
            <span
              key={d.discId}
              className="h-[34px] w-[34px] overflow-hidden rounded-full border-2 border-[#101C14] bg-[#F1EFE6]"
              style={{ marginLeft: i === 0 ? 0 : -8 }}
            >
              <DiscImage src={d.image} name={d.name} brand={d.brand} fit="cover" />
            </span>
          ))}
          {overflowDesktop > 0 && (
            <span
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#101C14] text-[10px] font-extrabold text-[#B8E04A]"
              style={{ marginLeft: -8 }}
            >
              +{overflowDesktop}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center sm:hidden">
          {group.discs.slice(0, THUMB_LIMIT_MOBILE).map((d, i) => (
            <span
              key={d.discId}
              className="h-[30px] w-[30px] overflow-hidden rounded-full border-2 border-[#101C14] bg-[#F1EFE6]"
              style={{ marginLeft: i === 0 ? 0 : -8 }}
            >
              <DiscImage src={d.image} name={d.name} brand={d.brand} fit="cover" />
            </span>
          ))}
          {overflowMobile > 0 && (
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[#101C14] text-[9px] font-extrabold text-[#B8E04A]"
              style={{ marginLeft: -8 }}
            >
              +{overflowMobile}
            </span>
          )}
        </span>

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EFE6] text-[#101C14]">
          <Chevron open={open} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="border-t-2 border-[#F1EFE6]">
          {group.discs.map((d) => (
            <Link
              key={d.discId}
              href={`/disc/${d.discId}/`}
              className="flex min-h-[56px] items-center gap-3 border-b border-[#F1EFE6] px-[18px] py-[11px] last:border-b-0 hover:bg-[#F1EFE6]/60 sm:min-h-[56px]"
            >
              <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] bg-[#F1EFE6]">
                <DiscImage src={d.image} name={d.name} brand={d.brand} fit="cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-extrabold text-[#101C14]">{d.name}</span>
                <span className="block text-[12px] text-[#101C1499]">
                  {d.brand}
                  {d.plastic ? ` · ${d.plastic}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-[16px] font-extrabold text-[#101C14]">kr {d.price}</span>
              <span className="hidden shrink-0 text-[#101C1466] sm:block">
                <Chevron open={false} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "Nytt i butikkutvalget" — store clusters instead of a flat accordion of
 * text rows. Uses CSS columns (not grid) so an expanded cluster doesn't
 * force a tall row height onto its neighbor in the other column — columns
 * balance themselves, grid rows don't.
 */
export function StoreClusters({ groups }: { groups: StoreArrivalGroup[] }) {
  if (groups.length === 0) return null;

  const totalDiscs = groups.reduce((sum, g) => sum + g.discs.length, 0);

  return (
    <section className="border-b-2 border-[#101C14] px-5 py-9 md:px-10 md:py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div>
            <h2 className="text-[22px] font-extrabold text-[#101C14] md:text-[26px]">Nytt i butikkutvalget</h2>
            <p className="text-[15px] text-[#101C1499]">Kjente disker som dukket opp hos en ny butikk.</p>
          </div>
          <p className="text-sm font-bold text-[#101C1499]">
            {totalDiscs} hos {groups.length} butikk{groups.length === 1 ? "" : "er"}
          </p>
        </div>

        <div className="mt-6 md:[column-gap:16px] md:[columns:2]">
          {groups.map((g, i) => (
            <Cluster key={g.store} group={g} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
