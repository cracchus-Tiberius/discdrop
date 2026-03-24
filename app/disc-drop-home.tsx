"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { DiscImage } from "@/components/DiscImage";
import {
  discs,
  hotDrops,
  upcoming,
} from "@/data/discs.js";

// ── Types ──────────────────────────────────────────────────────────────────
type Tab = "all" | "drivers" | "midrange" | "putters" | "onsale";

type Disc = (typeof discs)[number];

function bestPriceFromStores(stores: Disc["stores"]): number | null {
  const prices = stores.filter((s) => s.inStock).map((s) => s.price);
  return prices.length ? Math.min(...prices) : null;
}

function bestPriceNOK(disc: Disc) {
  return bestPriceFromStores(disc.stores);
}

function bestPriceForCompare(disc: Disc): number | null {
  const pool = disc.stores.filter((s) => s.inStock);
  const useStores = pool.length ? pool : disc.stores;
  const prices = useStores.map((s) => s.price);
  return prices.length ? Math.min(...prices) : null;
}

function isOnSale(disc: Disc): boolean {
  const best = bestPriceForCompare(disc);
  if (best == null) return false;
  let peak = 0;
  for (const p of disc.priceHistory) {
    if (typeof p === "number" && p > peak) peak = p;
  }
  if (peak === 0) return false;
  return best < peak;
}

function filterByTab(tab: Tab): Disc[] {
  switch (tab) {
    case "all":
      return discs;
    case "drivers":
      return discs.filter((d) => d.type === "driver");
    case "midrange":
      return discs.filter((d) => d.type === "midrange");
    case "putters":
      return discs.filter((d) => d.type === "putter");
    case "onsale":
      return discs.filter(isOnSale);
    default:
      return discs;
  }
}

const TAB_PILLS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "drivers", label: "Drivers" },
  { id: "midrange", label: "Mid-range" },
  { id: "putters", label: "Putters" },
  { id: "onsale", label: "On Sale" },
];

// ── Badge ──────────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  hot: "bg-[#E8704A] text-white",
  new: "bg-[#4CAF82] text-white",
  "new-drop": "bg-[#4CAF82] text-white",
  limited: "bg-[#9B59B6] text-white",
  "tour-series": "bg-[#6B5B95] text-white",
  "sold-out": "bg-[#888] text-white",
  upcoming: "bg-[#3B82F6] text-white",
};

const BADGE_LABELS: Record<string, string> = {
  hot: "HOT",
  new: "NEW DROP",
  "new-drop": "NEW DROP",
  limited: "LIMITED",
  "tour-series": "TOUR SERIES",
  "sold-out": "SOLD OUT",
  upcoming: "UPCOMING",
};

function Badge({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${BADGE_STYLES[tag] ?? "bg-gray-200 text-gray-700"}`}
    >
      {BADGE_LABELS[tag] ?? tag.toUpperCase()}
    </span>
  );
}

type Flight = Disc["flight"];


function FlightBoxes({ flight }: { flight: Flight }) {
  const cells: { label: string; value: number }[] = [
    { label: "SPEED", value: flight.speed },
    { label: "GLIDE", value: flight.glide },
    { label: "TURN", value: flight.turn },
    { label: "FADE", value: flight.fade },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="min-w-[3.25rem] rounded-lg bg-[#f5f5f3] px-3 py-2 text-center"
        >
          <div className="text-[10px] tracking-wider text-[#999]">{label}</div>
          <div className="text-lg font-semibold text-[#1a1a1a]">{value}</div>
        </div>
      ))}
    </div>
  );
}

type HotDropRow = {
  id: string;
  name: string;
  brand: string;
  flight: Flight;
  tags: string[];
  stores: Disc["stores"];
  player?: string;
  image?: string;
};

function buildHotDropRows(): HotDropRow[] {
  const fromData: HotDropRow[] = hotDrops.map((d) => ({
    id: d.id,
    name: d.name,
    brand: d.brand,
    flight: d.flight,
    tags: d.tags as string[],
    stores: d.stores,
    player: "player" in d ? d.player : undefined,
    image: "image" in d ? (d.image as string) : undefined,
  }));
  return fromData;
}

function hotDropCta(row: HotDropRow): {
  label: string;
  className: string;
} {
  if (row.stores.some((s) => s.inStock)) {
    return {
      label: "Find it",
      className:
        "rounded-lg bg-[#2D6A4F] px-4 py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:scale-[1.02] hover:brightness-110",
    };
  }
  if (row.tags.includes("upcoming")) {
    return {
      label: "Alert me",
      className:
        "rounded-lg border border-[#ddd] bg-white px-4 py-2.5 text-sm font-medium text-[#444] transition-all duration-150 ease-out hover:border-[#2D6A4F] hover:text-[#2D6A4F]",
    };
  }
  return {
    label: "Notify me",
    className:
      "rounded-lg border border-[#ddd] bg-white px-4 py-2.5 text-sm font-medium text-[#444] transition-all duration-150 ease-out hover:border-[#2D6A4F] hover:text-[#2D6A4F]",
  };
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav className="flex w-full items-center justify-between bg-[#F5F2EB] px-8 py-4">
      <Link
        href="/"
        className="flex shrink-0 items-center transition-opacity hover:opacity-85"
        style={{ gap: 10 }}
      >
        <Image
          src="/logo.svg"
          alt="DiscDrop"
          width={84}
          height={90}
          style={{ borderRadius: 4 }}
        />
        <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
          <span style={{ color: "#2D6A4F" }}>Disc</span>
          <span style={{ color: "#B8E04A" }}>Drop</span>
        </span>
      </Link>
      <div className="hidden items-center gap-8 text-sm text-[#444] md:flex">
        <a href="#" className="transition-colors hover:text-[#1a1a1a]">
          Home
        </a>
        <a href="#" className="transition-colors hover:text-[#1a1a1a]">
          Hot Drops
        </a>
        <a href="#" className="transition-colors hover:text-[#1a1a1a]">
          Browse
        </a>
        <Link
          href="/bag/build"
          className="flex items-center gap-1.5 rounded-full bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-[#B8E04A] transition-all hover:brightness-110"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Build My Bag
        </Link>
      </div>
      <button
        type="button"
        className="rounded-lg bg-[#2D6A4F] px-5 py-2.5 text-sm font-medium text-white transition-all duration-150 ease-out hover:scale-[1.02] hover:brightness-110"
      >
        Find a disc
      </button>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero({ discs: allDiscs }: { discs: Disc[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allDiscs
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          ("player" in d && d.player?.toLowerCase().includes(q))
      )
      .slice(0, 6);
  }, [query, allDiscs]);

  const typeLabel: Record<string, string> = {
    driver: "Distance Driver",
    midrange: "Midrange",
    putter: "Putter",
  };

  return (
    <section className="w-full bg-[#F5F2EB] px-8 pb-20 pt-16 text-center">
      <h1 className="mb-5 font-serif text-[72px] leading-none tracking-tight text-[#1a1a1a]">
        Find your flight.
      </h1>
      <p className="mb-10 text-lg leading-relaxed text-[#666]">
        The smartest way to shop disc golf in Norway.
        <br />
        Real prices. Real stock. Real landed cost.
      </p>

      <div className="mb-6 flex justify-center">
        <Link
          href="/bag/build"
          className="inline-flex items-center gap-2 rounded-xl bg-[#2D6A4F] px-6 py-3 text-sm font-medium text-white transition-all duration-150 ease-out hover:scale-[1.02] hover:brightness-110"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Build My Bag
        </Link>
      </div>

      <div className="relative mx-auto max-w-2xl">
        <div className="flex origin-center items-center gap-3 rounded-xl border-2 border-[#2D6A4F]/40 bg-white px-5 py-4 shadow-sm transition-all duration-200 ease-out focus-within:scale-[1.01] focus-within:border-[#2D6A4F] focus-within:shadow-md">
          <svg
            className="shrink-0 text-[#888]"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search discs, brands, players..."
            className="w-full bg-transparent text-base text-[#1a1a1a] outline-none placeholder:text-[#aaa]"
          />
        </div>

        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white shadow-lg">
            {results.map((d) => {
              const price = bestPriceNOK(d);
              return (
                <Link
                  key={d.id}
                  href={`/disc/${d.id}`}
                  onClick={() => setQuery("")}
                  className="flex cursor-pointer items-center justify-between border-b border-[#f0f0f0] px-5 py-3.5 transition-colors last:border-0 hover:bg-[#f9f9f7]"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1a1a1a]">{d.name}</span>
                    <span className="text-sm text-[#888]">{d.brand}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[#f0f0ee] px-2.5 py-1 text-xs text-[#888]">
                      {typeLabel[d.type] ?? d.type}
                    </span>
                    {price != null && (
                      <span className="text-sm font-medium text-[#1a1a1a]">
                        from kr {price}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Hot Drops ──────────────────────────────────────────────────────────────
function HotDrops() {
  const rows = useMemo(() => buildHotDropRows(), []);

  return (
    <section className="w-full bg-white px-8 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 font-serif text-3xl tracking-tight text-[#1a1a1a]">
          Hot Drops
        </h2>
        <p className="mb-8 max-w-xl text-[#666]">
          Limited runs and tour plastic worth watching.
        </p>
        <div className="overflow-visible pt-2 pb-2">
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 [scrollbar-width:thin] sm:mx-0 sm:px-0">
            {rows.map((row) => {
              const price = bestPriceFromStores(row.stores);
              const cta = hotDropCta(row);
              return (
                <Link
                  key={row.id}
                  href={`/disc/${row.id}`}
                  className="flex min-h-[22rem] w-[min(100%,300px)] shrink-0 flex-col rounded-2xl border border-[#e8e8e4] bg-[#fafaf8] p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#2D6A4F]/30 hover:shadow-lg"
                >
                  {row.image && (
                    <div className="mb-3 flex items-center justify-center rounded-xl bg-[#F5F2EB]" style={{ height: 120 }}>
                      <DiscImage src={row.image} name={row.name} brand={row.brand} containerStyle={{ height: 120 }} />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {row.tags.map((tag) => (
                      <Badge key={tag} tag={tag} />
                    ))}
                  </div>
                  <h3 className="mt-4 font-serif text-xl font-semibold text-[#1a1a1a]">
                    {row.name}
                  </h3>
                  <p className="text-sm text-[#666]">{row.brand}</p>
                  {row.player ? (
                    <p className="mt-1 text-sm text-[#444]">{row.player}</p>
                  ) : null}
                  <FlightBoxes flight={row.flight} />
                  <div className="mt-auto border-t border-[#e8e8e4] pt-4">
                    <p className="text-xs uppercase tracking-wider text-[#888]">
                      Best price
                    </p>
                    <p className="font-serif text-2xl font-semibold text-[#2D6A4F]">
                      {price != null ? `${price} kr` : "—"}
                    </p>
                    <div className={`mt-4 w-full text-center ${cta.className}`}>
                      {cta.label}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Upcoming ───────────────────────────────────────────────────────────────
function UpcomingSection() {
  return (
    <section className="w-full bg-[#F5F2EB] px-8 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 font-serif text-3xl tracking-tight text-[#1a1a1a]">
          Upcoming
        </h2>
        <p className="mb-8 text-[#666]">
          Drops we&apos;re tracking before they hit the shelves.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {upcoming.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[#e0ddd4] bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-semibold text-[#1a1a1a]">
                    {item.name}
                  </h3>
                  <p className="text-sm text-[#666]">{item.brand}</p>
                </div>
                <Badge tag="upcoming" />
              </div>
              {"player" in item && item.player ? (
                <p className="mt-2 text-sm text-[#444]">{item.player}</p>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-[#555]">
                {item.description}
              </p>
              <p className="mt-4 text-xs font-medium uppercase tracking-wider text-[#2D6A4F]">
                Expected {item.expectedDate}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── Browse grid ────────────────────────────────────────────────────────────
function BrowseGrid({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const list = useMemo(() => filterByTab(tab), [tab]);

  const typeLabel: Record<string, string> = {
    driver: "Driver",
    midrange: "Mid-range",
    putter: "Putter",
  };

  return (
    <section className="w-full bg-white px-8 pb-20 pt-4">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 font-serif text-3xl tracking-tight text-[#1a1a1a]">
          Browse
        </h2>
        <p className="mb-6 text-[#666]">
          {list.length} disc{list.length === 1 ? "" : "s"} ·{" "}
          {TAB_PILLS.find((t) => t.id === tab)?.label}
        </p>
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {TAB_PILLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-[#2D6A4F] text-white shadow-md"
                  : "bg-[#f0f0ee] text-[#555] hover:bg-[#e5e5e0]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => {
            const price = bestPriceNOK(d);
            const f = d.flight;
            return (
              <Link
                key={d.id}
                href={`/disc/${d.id}`}
                className="rounded-2xl border border-[#e8e8e4] bg-[#fafaf8] p-5 transition-shadow hover:shadow-md"
              >
                {d.image && (
                  <div className="mb-4 flex items-center justify-center rounded-xl bg-[#F5F2EB]" style={{ height: 120 }}>
                    <DiscImage src={d.image} name={d.name} brand={d.brand} containerStyle={{ height: 120 }} />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-[#1a1a1a]">
                      {d.name}
                    </h3>
                    <p className="text-sm text-[#666]">{d.brand}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[#f0f0ee] px-2 py-1 text-xs text-[#666]">
                    {typeLabel[d.type] ?? d.type}
                  </span>
                </div>
                <FlightBoxes flight={f} />
                <div className="mt-4 flex items-end justify-between border-t border-[#e8e8e4] pt-4">
                  <div>
                    <p className="text-xs text-[#888]">From</p>
                    <p className="font-serif text-xl font-semibold text-[#2D6A4F]">
                      {price != null ? `${price} kr` : "—"}
                    </p>
                  </div>
                  <p className="text-sm text-[#888]">
                    {d.stores.length} store{d.stores.length === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function DiscDropHome() {
  const [tab, setTab] = useState<Tab>("all");

  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      <Navbar />
      <main>
        <Hero discs={discs} />
        <HotDrops />
        <UpcomingSection />
        <BrowseGrid tab={tab} onTab={setTab} />
      </main>
      <footer className="bg-[#1E3D2F] px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-[13px] sm:flex-row sm:justify-between">
          <span className="text-[#9DC08B]">© 2026 DiscDrop — Kviist Studio</span>
          <span className="text-[#7a9a82] italic">
            Vi tjener provisjon på kjøp via lenker på siden
          </span>
          <div className="flex items-center gap-4 text-[#9DC08B]">
            <Link href="/personvern" className="hover:text-[#F5F2EB] transition-colors">
              Personvern
            </Link>
            <a
              href="mailto:kontakt@discdrop.net"
              className="hover:text-[#F5F2EB] transition-colors"
            >
              kontakt@discdrop.net
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
