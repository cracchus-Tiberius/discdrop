"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DiscImage } from "@/components/DiscImage";
import { SearchInput } from "@/components/SearchInput";
import { getScrapedPrice, getDiscImage, getDiscLastScraped } from "@/lib/disc-utils";
import { discs } from "@/data/discs.js";

type Disc = (typeof discs)[number];
type TypeFilter = "all" | "distance" | "fairway" | "midrange" | "putter";
type SortBy = "newest" | "price" | "stores" | "speed-asc" | "speed-desc" | "fade-desc" | "turn-asc" | "az";
type ChipId =
  | "available"
  | "beginner"
  | "distance"
  | "overstable"
  | "understable"
  | "budget"
  | "most-stores"
  | "hot"
  | "new-drop";

// ── Helpers ──────────────────────────────────────────────────────────────────

function bestPriceNOK(disc: Disc): number | null {
  return getScrapedPrice(disc.id).price;
}

function storeCount(disc: Disc): number {
  return getScrapedPrice(disc.id).inStockCount;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Alle typer" },
  { id: "distance", label: "Distance Driver" },
  { id: "fairway", label: "Fairway Driver" },
  { id: "midrange", label: "Midrange" },
  { id: "putter", label: "Putter" },
];

const SORT_OPTIONS: { id: SortBy; label: string }[] = [
  { id: "newest", label: "Nyeste" },
  { id: "price", label: "Beste pris" },
  { id: "stores", label: "Flest butikker" },
  { id: "speed-asc", label: "Hastighet ↑" },
  { id: "speed-desc", label: "Hastighet ↓" },
  { id: "az", label: "Navn A–Å" },
];

// Chip-implied sort overrides (active when user hasn't manually set sort)
const CHIP_IMPLIED_SORT: Partial<Record<ChipId, SortBy>> = {
  distance: "speed-desc",
  overstable: "fade-desc",
  understable: "turn-asc",
  "most-stores": "stores",
};

const BADGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hot: { bg: "#E8704A", text: "#fff", label: "HOT" },
  new: { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  "new-drop": { bg: "#4CAF82", text: "#fff", label: "NY DROP" },
  limited: { bg: "#9B59B6", text: "#fff", label: "BEGRENSET" },
  "tour-series": { bg: "#6B5B95", text: "#fff", label: "TOUR SERIES" },
  "sold-out": { bg: "#888", text: "#fff", label: "UTSOLGT" },
};

const CHIPS: {
  id: ChipId;
  emoji: string;
  label: string;
  fn?: (d: Disc) => boolean;
}[] = [
  {
    id: "available",
    emoji: "🛒",
    label: "Tilgjengelig nå",
    fn: (d) => bestPriceNOK(d) !== null,
  },
  {
    id: "hot",
    emoji: "🔥",
    label: "Hot",
    fn: (d) => (d.tags as string[]).includes("hot"),
  },
  {
    id: "new-drop",
    emoji: "✨",
    label: "Nye slipp",
    fn: (d) => (d.tags as string[]).some((t) => t === "new" || t === "new-drop"),
  },
  {
    id: "beginner",
    emoji: "🟢",
    label: "Nybegynner",
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
    label: "Overstabil",
    fn: (d) => d.flight.fade >= 3,
  },
  {
    id: "understable",
    emoji: "🌀",
    label: "Understabil",
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
    label: "Flest butikker",
    // no fn — activating this chip overrides sort to "stores"
  },
];

const BRANDS = [
  "Alle merker",
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
    <div className="mt-3 flex gap-1">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="flex-1 rounded-lg bg-[#F1EFE6] py-1.5 text-center"
        >
          <div className="text-sm font-extrabold text-[#101C14]">{value}</div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-[#101C1488]">{label}</div>
        </div>
      ))}
    </div>
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
    () => searchParams.get("brand") ?? "Alle merker"
  );
  const [sort, setSort] = useState<SortBy>(
    () => (searchParams.get("sort") as SortBy) ?? "newest"
  );
  const [sortManuallySet, setSortManuallySet] = useState(() => searchParams.has("sort"));
  const [activeChip, setActiveChip] = useState<ChipId | null>(
    () => (searchParams.get("chip") as ChipId) ?? "available"
  );

  // Push filter changes to URL (replace so Back works naturally)
  const pushUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (!v || v === "all" || v === "Alle merker" || v === "newest" || v === "available") {
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
    setSortManuallySet(true);
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
    setBrand("Alle merker");
    setSort("newest");
    setSortManuallySet(false);
    setActiveChip("available");
    router.replace(pathname, { scroll: false });
  }

  // Effective sort: chip-implied sort overrides default when user hasn't manually set sort
  const effectiveSort: SortBy =
    !sortManuallySet && activeChip && CHIP_IMPLIED_SORT[activeChip]
      ? CHIP_IMPLIED_SORT[activeChip]!
      : sort;

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
    if (brand !== "Alle merker") {
      list = list.filter((d) => d.brand === brand);
    }

    // Active chip filter (only chips that have fn)
    if (activeChip && activeChip !== "most-stores") {
      const chip = CHIPS.find((c) => c.id === activeChip);
      if (chip?.fn) list = list.filter(chip.fn);
    }

    // Sort
    list = [...list];
    if (effectiveSort === "newest") {
      list.sort((a, b) => {
        const da = getDiscLastScraped(a.id);
        const db = getDiscLastScraped(b.id);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db.localeCompare(da);
      });
    } else if (effectiveSort === "price") {
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
    } else if (effectiveSort === "fade-desc") {
      list.sort((a, b) => b.flight.fade - a.flight.fade);
    } else if (effectiveSort === "turn-asc") {
      list.sort((a, b) => a.flight.turn - b.flight.turn);
    } else if (effectiveSort === "az") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [query, typeFilter, brand, activeChip, effectiveSort]);

  const hasActiveFilters =
    query !== "" ||
    typeFilter !== "all" ||
    brand !== "Alle merker" ||
    sort !== "newest" ||
    activeChip !== "available";

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    function onScroll() { setShowScrollTop(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <SiteHeader />

      {/* Hero banner */}
      <section className="w-full border-b-2 border-[#101C14] bg-[#FFFDF6] px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-[#101C14] sm:text-5xl">
              Alle disker
            </h1>
            <p className="text-sm text-[#101C1499] sm:text-base">
              {discs.length} disker fra {BRAND_COUNT} merker
            </p>
          </div>
          <div className="mt-6">
            <SearchInput
              value={query}
              onChange={handleQuery}
              placeholder="Søk etter disk, merke eller type..."
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">

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
                  className={`dd-selectable flex shrink-0 items-center gap-1.5 rounded-full bg-[#F1EFE6] px-3.5 py-2 text-sm font-semibold text-[#101C14] min-h-[40px] ${
                    active ? "dd-active" : ""
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
            className="rounded-xl border-2 border-[#101C14] bg-white px-3 py-2 text-sm font-semibold text-[#101C14] outline-none"
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
            className="rounded-xl border-2 border-[#101C14] bg-white px-3 py-2 text-sm font-semibold text-[#101C14] outline-none"
          >
            {BRANDS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => handleSort(e.target.value as SortBy)}
            className="rounded-xl border-2 border-[#101C14] bg-white px-3 py-2 text-sm font-semibold text-[#101C14] outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <span className="ml-auto text-sm font-semibold text-[#101C1499]">
            Viser {filtered.length} disk{filtered.length === 1 ? "" : "er"}
          </span>
        </div>

        {/* Grid or empty state */}
        {filtered.length === 0 ? (
          <div className="mt-20 flex flex-col items-center gap-4 text-center">
            <p className="text-lg text-[#101C1499]">Ingen disker funnet</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="dd-cta px-5 py-2.5 text-sm"
              >
                Nullstill filter
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((d) => {
              const price = bestPriceNOK(d);
              const unavailable = price === null;
              return (
                <Link
                  key={d.id}
                  href={`/disc/${d.id}`}
                  className={`rounded-2xl border-2 border-[#101C14] bg-white p-4 transition-transform duration-150 hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[5px_5px_0_#B8E04A] ${
                    unavailable ? "opacity-60" : ""
                  }`}
                >
                  <div
                    className="relative mb-3 flex items-center justify-center rounded-xl bg-[#F1EFE6]"
                    style={{ height: 100 }}
                  >
                    <DiscImage
                      src={getDiscImage(d)}
                      name={d.name}
                      brand={d.brand}
                      type={d.type}
                      containerStyle={{ height: 100 }}
                    />
                    {(d.tags as string[]).some((t) => BADGE_STYLES[t]) && (
                      <div className="absolute left-2 top-2 flex flex-col gap-1">
                        {(d.tags as string[])
                          .filter((t) => BADGE_STYLES[t])
                          .slice(0, 2)
                          .map((tag) => {
                            const s = BADGE_STYLES[tag];
                            const chipId: ChipId | null =
                              tag === "hot" ? "hot"
                              : tag === "new" || tag === "new-drop" ? "new-drop"
                              : null;
                            return chipId ? (
                              <span
                                key={tag}
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleChip(chipId); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleChip(chipId); } }}
                                className="dd-sticker cursor-pointer text-[9px]"
                                style={{ background: s.bg, color: s.text, boxShadow: "1.5px 1.5px 0 #101C14" }}
                              >
                                {s.label}
                              </span>
                            ) : (
                              <span
                                key={tag}
                                className="dd-sticker text-[9px]"
                                style={{ background: s.bg, color: s.text, boxShadow: "1.5px 1.5px 0 #101C14" }}
                              >
                                {s.label}
                              </span>
                            );
                          })}
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-extrabold text-[#101C14]">
                        {d.name}
                      </h3>
                      <p className="truncate text-xs text-[#101C1499]">{d.brand}</p>
                    </div>
                    <span className="ml-1 shrink-0 rounded bg-[#F1EFE6] px-1.5 py-0.5 text-[10px] font-semibold text-[#101C1499]">
                      {TYPE_LABEL[d.type] ?? d.type}
                    </span>
                  </div>
                  <FlightBoxes flight={d.flight} />
                  <div className="mt-3 border-t-2 border-[#F1EFE6] pt-3">
                    {unavailable ? (
                      <span className="inline-flex items-center rounded-full bg-[#F1EFE6] px-2.5 py-1 text-xs font-semibold text-[#101C1477]">
                        Ikke i butikk
                      </span>
                    ) : (
                      <>
                        <p className="text-lg font-extrabold text-[#101C14]">
                          fra kr {price}
                        </p>
                        {storeCount(d) > 0 && (
                          <p className="text-xs text-[#101C1499]">
                            {storeCount(d)} butikk
                            {storeCount(d) === 1 ? "" : "er"}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      <footer className="mt-16 border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-[12px] text-[#FFFDF699]">
          <span>© 2026 discdrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#B8E04A] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#FFFDF6]">Personvern</Link>
            <Link href="/kontakt" className="transition-colors hover:text-[#FFFDF6]">Kontakt</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#FFFDF6]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>

      {/* Scroll to top */}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Scroll til toppen"
        className={`dd-cta fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 ${
          showScrollTop ? "opacity-100 scale-100" : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
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
