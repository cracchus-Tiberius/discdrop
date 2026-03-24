"use client";

import { useMemo } from "react";
import { FlightNumbers } from "@/components/FlightNumbers";
import {
  filterByTab,
  getBestInStockNOK,
  TABS,
  type Disc,
  type TabId,
} from "@/lib/disc-utils";

export default function AllDiscs({
  tab,
  discs,
}: {
  tab: TabId;
  discs: Disc[];
}) {
  const gridDiscs = useMemo(() => filterByTab(discs, tab), [discs, tab]);

  return (
    <section className="border-t border-white/5 px-4 pb-16 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          All discs
        </h2>
        <p className="mt-1 text-sm text-muted">
          {gridDiscs.length} disc{gridDiscs.length === 1 ? "" : "s"} ·{" "}
          {TABS.find((x) => x.id === tab)?.label}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gridDiscs.map((d) => {
            const { best, storeCount } = getBestInStockNOK(d);
            const typeLabel =
              d.type === "midrange"
                ? "Mid-range"
                : d.type.charAt(0).toUpperCase() + d.type.slice(1);
            return (
              <article
                key={d.id}
                className="group rounded-2xl border border-white/10 border-l-2 border-l-transparent bg-surface p-5 transition-[border-color,box-shadow,background-color] hover:border-l-accent hover:shadow-lg hover:shadow-black/25"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-lg font-semibold text-foreground group-hover:text-accent">
                      {d.name}
                    </h3>
                    <p className="text-sm text-muted">{d.brand}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-xs font-medium text-muted ring-1 ring-white/10">
                    {typeLabel}
                  </span>
                </div>
                <FlightNumbers flight={d.flight} />
                <div className="mt-4 flex items-end justify-between border-t border-white/10 pt-4">
                  <div>
                    <p className="text-xs text-muted">From</p>
                    <p className="font-heading text-xl font-semibold text-accent">
                      {best} kr
                    </p>
                  </div>
                  <p className="text-sm text-muted">
                    {storeCount} store
                    {storeCount === 1 ? "" : "s"}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
