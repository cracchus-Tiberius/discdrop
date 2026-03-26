"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useCallback, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DiscImage } from "@/components/DiscImage";
import { discs } from "@/data/discs.js";

type Disc = (typeof discs)[number];
type TypeFilter = "all" | "distance" | "fairway" | "midrange" | "putter";
type SortBy = "price" | "stores" | "speed-asc" | "speed-desc" | "az";
type ChipId =
  | "beginner"
  | "distance"
  | "overstable"
  | "understable"
  | "budget"
  | "most-stores";

// ── Helpers ──────────────────────────────────────────────────────────────────

function bestPriceNOK(disc: Disc): number | null {
  const inStock = disc.stores.filter((s) => s.inStock).map((s) => s.price);
  const pool = inStock.length ? inStock : disc.stores.map((s) => s.price);
  return pool.length ? Math.min(...pool) : null;
}

function storeCount(disc: Disc): number {
  return disc.stores.filter((s) => s.inStock).length;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "distance", label: "Distance Driver" },
  { id: "fairway", label: "Fairway Driver" },
  { id: "midrange", label: "Midrange" },
  { id: "putter", label: "Putter" },
];

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "price", label: "Best price" },
  { id: "stores", label: "Most stores" },
  { id: "speed-asc", label: "Speed ↑" },
  { id: "speed-desc", label: "Speed ↓" },
  { id: "az", label: "Name A–Z" },
];

const CHIPS: {
  id: ChipId;
  emoji: string;
  label: string;
  fn?: (d: Disc) => boolean;
}[] = [
  {
    id: "beginner",
    emoji: "🟢",
    label: "Beginner",
    fn: (d) => d.flight.speed <= 7 && d.flight.turn <= -1,
  },
  {
    id: "distance",
    emoji: "💨",
    label: "Distance",
    fn: (d) => d.flight.speed >= 11,
  },
  {
    id: "overstable",
    emoji: "🎯",
    label: "Overstable",
    fn: (d) => d.flight.fade >= 3,
  },
  {
    id: "understable",
    emoji: "🌀",
    label: "Understable",
    fn: (d) => d.flight.turn <= -2,
  },
  {
    id: "budget",
    emoji: "💰",
    label: "Under kr 200",
    fn: (d) => {
      const p = bestPriceNOK(d);
      return p !== null && p < 200;
    },
  },
  {
    id: "most-stores",
    emoji: "⭐",
    label: "Most stores",
    // no fn — activating this chip overrides sort to "stores"
  },
];

const BRANDS = [
  "All brands",
  ...Array.from(new Set(discs.map((d) => d.brand))).sort(),
];
const BRAND_COUNT = new Set(discs.map((d) => d.brand)).size;

const TYPE_LABEL: Record<string, string> = {
  driver: "Driver",
  midrange: "Mid-range",
  putter: "Putter",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FlightBoxes({ flight }: { flight: Disc["flight"] }) {
  const cells = [
    { label: "S", value: flight.speed },
    { label: "G", value: flight.glide },
    { label: "T", value: flight.turn },
    { label: "F", value: flight.fade },
  ];
  return (
    <div className="mt-3 flex gap-1.5">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="flex-1 rounded-lg bg-[#f5f5f3] py-1.5 text-center"
        >
          <div className="text-[9px] tracking-wider text-[#999]">{label}</div>
          <div className="text-sm font-semibold text-[#1a1a1a]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function Navbar() {
  return (
    <nav className="sticky top-0 z-50 flex w-full items-center justify-between bg-[#F5F2EB] px-8 py-4 shadow-sm">
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
        <Link href="/" className="transition-colors hover:text-[#1a1a1a]">
          Home
        </Link>
        <Link href="/browse" className="font-medium text-[#2D6A4F]">
          Browse
        </Link>
        <Link
          href="/bag/build"
          className="flex items-center gap-1.5 rounded-full bg-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-[#B8E04A] transition-all hover:brightness-110"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          Build My Bag
        </Link>
      </div>
    </nav>
  );
}

// ── Browse content (needs Suspense because of useSearchParams) ────────────────

function BrowseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // State — initialised from URL params
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    () => (searchParams.get("type") as TypeFilter) ?? "all"
  );
  const [brand, setBrand] = useState(
    () => searchParams.get("brand") ?? "All brands"
  );
  const [sort, setSort] = useState<SortBy>(
    () => (searchParams.get("sort") as SortBy) ?? "price"
  );
  const [activeChip, setActiveChip] = useState<ChipId | null>(
    () => (searchParams.get("chip") as ChipId) ?? null
  );

  // Push filter changes to URL (replace so Back works naturally)
  const pushUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all" || v === "All brands" || v === "price") {
          params.delete(k);
        } else {
          params.set(k, v);
        }
      }
      const qs = params.toString();
      router.replace(pathname + (qs ? "?" + qs : ""), { scroll: false });
    },
    [searchParams, router, pathname]
  );

  function handleQuery(v: string) {
    setQuery(v);
    pushUrl({ q: v });
  }

  function handleType(v: TypeFilter) {
    setTypeFilter(v);
    pushUrl({ type: v });
  }

  function handleBrand(v: string) {
    setBrand(v);
    pushUrl({ brand: v });
  }

  function handleSort(v: SortBy) {
    setSort(v);
    pushUrl({ sort: v });
  }

  function handleChip(id: ChipId) {
    const next = activeChip === id ? null : id;
    setActiveChip(next);
    pushUrl({ chip: next ?? "" });
  }

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setBrand("All brands");
    setSort("price");
    setActiveChip(null);
    router.replace(pathname, { scroll: false });
  }

  // Effective sort: "most-stores" chip overrides
  const effectiveSort: SortBy = activeChip === "most-stores" ? "stores" : sort;

  const filtered = useMemo(() => {
    let list = discs as Disc[];

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.brand.toLowerCase().includes(q) ||
          d.type.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter === "distance") {
      list = list.filter((d) => d.type === "driver" && d.flight.speed >= 10);
    } else if (typeFilter === "fairway") {
      list = list.filter((d) => d.type === "driver" && d.flight.speed < 10);
    } else if (typeFilter === "midrange") {
      list = list.filter((d) => d.type === "midrange");
    } else if (typeFilter === "putter") {
      list = list.filter((d) => d.type === "putter");
    }

    // Brand filter
    if (brand !== "All brands") {
      list = list.filter((d) => d.brand === brand);
    }

    // Active chip filter (only chips that have fn)
    if (activeChip && activeChip !== "most-stores") {
      const chip = CHIPS.find((c) => c.id === activeChip);
      if (chip?.fn) list = list.filter(chip.fn);
    }

    // Sort
    list = [...list];
    if (effectiveSort === "price") {
      list.sort((a, b) => {
        const pa = bestPriceNOK(a) ?? Infinity;
        const pb = bestPriceNOK(b) ?? Infinity;
        return pa - pb;
      });
    } else if (effectiveSort === "stores") {
      list.sort((a, b) => storeCount(b) - storeCount(a));
    } else if (effectiveSort === "speed-asc") {
      list.sort((a, b) => a.flight.speed - b.flight.speed);
    } else if (effectiveSort === "speed-desc") {
      list.sort((a, b) => b.flight.speed - a.flight.speed);
    } else if (effectiveSort === "az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [query, typeFilter, brand, activeChip, effectiveSort]);

  const hasActiveFilters =
    query !== "" ||
    typeFilter !== "all" ||
    brand !== "All brands" ||
    sort !== "price" ||
    activeChip !== null;

  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-serif text-4xl font-semibold tracking-tight text-[#1a1a1a] sm:text-5xl">
            Browse discs
          </h1>
          <p className="mt-2 text-[#666]">
            {discs.length} discer fra {BRAND_COUNT} merker
          </p>
        </div>

        {/* Search input */}
        <div className="relative mb-5">
          <div className="flex items-center gap-3 rounded-xl border-2 border-[#2D6A4F]/40 bg-white px-5 py-4 shadow-sm transition-all duration-200 focus-within:border-[#2D6A4F] focus-within:shadow-md">
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
              onChange={(e) => handleQuery(e.target.value)}
              placeholder="Søk etter disc, merke eller type..."
              className="w-full bg-transparent text-base text-[#1a1a1a] outline-none placeholder:text-[#aaa]"
            />
            {query && (
              <button
                type="button"
                onClick={() => handleQuery("")}
                aria-label="Tøm søk"
                className="shrink-0 rounded-full p-1 text-[#999] transition-colors hover:bg-[#f0f0ee] hover:text-[#1a1a1a]"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Smart filter chips — single-select */}
        <div className="-mx-4 flex overflow-x-auto px-4 pb-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <div className="flex gap-2">
            {CHIPS.map((chip) => {
              const active = activeChip === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => handleChip(chip.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#B8E04A] text-[#1a1a1a]"
                      : "bg-white text-[#2D6A4F] ring-1 ring-[#2D6A4F] hover:bg-[#f0f9f4]"
                  }`}
                >
                  <span aria-hidden>{chip.emoji}</span>
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter bar: Type · Brand · Sort */}
        <div className="mb-5 mt-1 flex flex-wrap items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => handleType(e.target.value as TypeFilter)}
            className="rounded-lg border border-[#e0ddd4] bg-white px-3 py-2 text-sm text-[#444] outline-none focus:border-[#2D6A4F]"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={brand}
            onChange={(e) => handleBrand(e.target.value)}
            className="rounded-lg border border-[#e0ddd4] bg-white px-3 py-2 text-sm text-[#444] outline-none focus:border-[#2D6A4F]"
          >
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => handleSort(e.target.value as SortBy)}
            className="rounded-lg border border-[#e0ddd4] bg-white px-3 py-2 text-sm text-[#444] outline-none focus:border-[#2D6A4F]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-sm text-[#888]">
            Viser {filtered.length} disc{filtered.length === 1 ? "" : "er"}
          </span>
        </div>

        {/* Grid or empty state */}
        {filtered.length === 0 ? (
          <div className="mt-20 flex flex-col items-center gap-4 text-center">
            <p className="text-lg text-[#888]">Ingen discer funnet</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-[#2D6A4F] px-5 py-2 text-sm font-medium text-[#2D6A4F] transition-colors hover:bg-[#2D6A4F]/5"
              >
                Nullstill filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((d) => {
              const price = bestPriceNOK(d);
              return (
                <Link
                  key={d.id}
                  href={`/disc/${d.id}`}
                  className="rounded-2xl border border-[#e8e8e4] bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className="mb-3 flex items-center justify-center rounded-xl bg-[#F5F2EB]"
                    style={{ height: 100 }}
                  >
                    <DiscImage
                      src={"image" in d ? (d.image as string) : ""}
                      name={d.name}
                      brand={d.brand}
                      type={d.type}
                      containerStyle={{ height: 100 }}
                    />
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="truncate font-serif text-base font-semibold text-[#1a1a1a]">
                        {d.name}
                      </h3>
                      <p className="truncate text-xs text-[#666]">{d.brand}</p>
                    </div>
                    <span className="ml-1 shrink-0 rounded bg-[#f0f0ee] px-1.5 py-0.5 text-[10px] text-[#666]">
                      {TYPE_LABEL[d.type] ?? d.type}
                    </span>
                  </div>
                  <FlightBoxes flight={d.flight} />
                  <div className="mt-3 border-t border-[#f0ede6] pt-3">
                    <p className="font-serif text-lg font-semibold text-[#2D6A4F]">
                      {price != null ? `${price} kr` : "—"}
                    </p>
                    {storeCount(d) > 0 && (
                      <p className="text-xs text-[#888]">
                        {storeCount(d)} butikk
                        {storeCount(d) === 1 ? "" : "er"}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-16 bg-[#1E3D2F] px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-[13px] sm:flex-row sm:justify-between">
          <span className="text-[#9DC08B]">© 2026 DiscDrop — Kviist Studio</span>
          <div className="flex items-center gap-4 text-[#9DC08B]">
            <Link
              href="/personvern"
              className="transition-colors hover:text-[#F5F2EB]"
            >
              Personvern
            </Link>
            <a
              href="mailto:kontakt@discdrop.net"
              className="transition-colors hover:text-[#F5F2EB]"
            >
              kontakt@discdrop.net
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
// BrowseContent uses useSearchParams, which requires a Suspense boundary on
// static routes (Next.js 16 requirement — see docs/use-search-params.md).

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5F2EB]" />}>
      <BrowseContent />
    </Suspense>
  );
}
