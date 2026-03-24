"use client";

import { useMemo, useState } from "react";
import {
  getBestInStockNOK,
  matchesSearch,
  TABS,
  type Disc,
  type TabId,
} from "@/lib/disc-utils";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

type HeroProps = {
  tab: TabId;
  onTabChange: (id: TabId) => void;
  discs: Disc[];
};

export default function Hero({ tab, onTabChange, discs }: HeroProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return discs.filter((d) => matchesSearch(d, q)).slice(0, 8);
  }, [query, discs]);

  return (
    <>
      <section className="border-b border-white/5 px-4 pb-12 pt-10 sm:px-6 sm:pt-14">
        <div className="relative mx-auto max-w-3xl text-center">
          <div
            className="pointer-events-none absolute left-1/2 top-[42%] -z-0 h-[min(100%,280px)] w-[min(120%,520px)] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgba(184,224,74,0.05)_0%,transparent_68%)]"
            aria-hidden
          />
          <div className="relative z-10">
            <h1 className="font-heading text-5xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-7xl">
              Find your flight.
            </h1>
            <p className="mt-3 text-lg text-muted sm:text-xl">Skip the legwork.</p>
          </div>

          <div className="relative z-10 mx-auto mt-10 max-w-xl text-left">
            <label htmlFor="disc-search" className="sr-only">
              Search discs
            </label>
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
              <SearchIcon className="h-5 w-5" />
            </div>
            <input
              id="disc-search"
              type="search"
              autoComplete="off"
              placeholder="Search discs, brands, players…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                window.setTimeout(() => setSearchOpen(false), 180);
              }}
              className="h-14 w-full rounded-2xl border border-white/10 bg-surface pl-12 pr-4 text-base text-foreground shadow-lg shadow-black/20 outline-none ring-accent/30 placeholder:text-muted/80 focus:border-accent/40 focus:ring-2"
            />
            {searchOpen && query.trim() && (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-80 overflow-auto rounded-xl border border-white/10 bg-surface py-2 shadow-xl">
                {suggestions.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted">No matches</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {suggestions.map((d) => {
                      const { best } = getBestInStockNOK(d);
                      return (
                        <li key={d.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/5"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setQuery(d.name);
                              setSearchOpen(false);
                            }}
                          >
                            <span>
                              <span className="font-medium text-foreground">
                                {d.name}
                              </span>
                              <span className="ml-2 text-sm text-muted">
                                {d.brand}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm tabular-nums text-accent">
                              from {best} kr
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-b border-white/5 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-accent text-background shadow-[0_0_20px_-4px_rgba(184,224,74,0.5)]"
                  : "bg-surface text-muted ring-1 ring-white/10 hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
