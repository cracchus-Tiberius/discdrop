"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { DiscImage } from "@/components/DiscImage";
import { SearchInput } from "@/components/SearchInput";
import { discs } from "@/data/discs.js";
import scrapedPrices from "@/data/scraped-prices.json";
import { getScrapedPrice, getDiscImage } from "@/lib/disc-utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Disc = (typeof discs)[number];

function bestPriceNOK(disc: Disc): number | null {
  return getScrapedPrice(disc.id).price;
}

// ── Badge ──────────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  hot: "bg-[#E8704A] text-white",
  new: "bg-[#4CAF82] text-white",
  "new-drop": "bg-[#4CAF82] text-white",
  limited: "bg-[#9B59B6] text-white",
  "tour-series": "bg-[#6B5B95] text-white",
  "sold-out": "bg-[#888] text-white",
};

const BADGE_LABELS: Record<string, string> = {
  hot: "HOT",
  new: "NY DROP",
  "new-drop": "NY DROP",
  limited: "BEGRENSET",
  "tour-series": "TOUR SERIES",
  "sold-out": "UTSOLGT",
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

// Keywords that classify a hot-drop badge type
const TOUR_SERIES_KEYWORDS = [
  'Tour Series', 'Team Series', 'Team Championship Series', 'Signature Series', 'Mold Team',
];
const LIMITED_KEYWORDS = [
  'Limited Edition', 'Special Edition', 'Prototype', 'First Run', 'Primal Run',
  'Project Lab Coat', 'Lab Coat',
];
const HOT_PLAYER_NAMES = [
  'Eagle McMahon', 'Calvin Heimburg', 'Ricky Wysocki', 'Simon Lizotte',
  'Paige Pierce', 'Brodie Smith', 'Paul McBeth', 'Niklas Anttila',
  'Bradley Williams', 'Gannon Buhr', 'Clay Edwards', 'Casey White',
  'Nate Sexton', 'Anthony Barela', 'Catrina Allen', 'Henna Blomroos',
  'Eveliina Salonen', 'Vaino Makela', 'Kristofer Hivju', 'Albert Tamm',
  'Kristin Lätt', 'Kristin Tattar', 'JohnE McCray', 'Dallas Garber',
  'Joseph Anderson', 'Silva Saarinen', 'Sockibomb',
  'Jeremy Koling', 'James Conrad', 'Kona Montgomery',
  'Ida Emilie Nesse', 'Anniken Steen', 'Julia Fors', 'Juliana Korver',
  'Josef Berg', 'Cadence Burge', 'Kyle Klein', 'Aaron Gossage',
  'Holyn Handley', 'Ella Hansen', 'Isaac Robinson',
];

// All edition keywords that qualify a disc as a hot drop
const ALL_HOT_EDITION_KEYWORDS = new Set([
  ...TOUR_SERIES_KEYWORDS, ...LIMITED_KEYWORDS, ...HOT_PLAYER_NAMES,
  'Ledgestone', 'OTB Open', 'Gyropalooza', 'MVP Open', 'USDGC', 'EDGF',
  'World Championship', 'Nordic Phenom', 'Sky Stone', 'Solar Flare', 'Get Freaky', 'Show Stopper',
]);

/** Return the badge tag that best describes an edition string */
function editionToBadge(edition: string | null, inStock: boolean, lastScraped?: string): string {
  if (!edition) return inStock ? 'hot' : 'sold-out';
  if (!inStock) return 'sold-out';

  // Check if newly scraped (within last 7 days)
  if (lastScraped) {
    const scrapedDate = new Date(lastScraped);
    const ageMs = Date.now() - scrapedDate.getTime();
    if (ageMs < 7 * 24 * 60 * 60 * 1000) return 'new-drop';
  }

  const ed = edition.toLowerCase();
  if (TOUR_SERIES_KEYWORDS.some((kw) => ed.includes(kw.toLowerCase()))) return 'tour-series';
  if (LIMITED_KEYWORDS.some((kw) => ed.includes(kw.toLowerCase()))) return 'limited';
  if (HOT_PLAYER_NAMES.some((p) => ed.includes(p.toLowerCase()))) return 'tour-series';
  return 'hot';
}

type HotDropRow = {
  id: string;
  name: string;
  brand: string;
  type: string;
  flight: Flight;
  badge: string;
  edition: string | null;
  price: number | null;
  inStock: boolean;
  image: string;
  lastScraped: string | null;
};

function buildHotDropRows(): HotDropRow[] {
  type ScrapedEntry = { price: number; inStock: boolean; edition?: string | null; lastScraped?: string };
  const prices = (scrapedPrices as { prices: Record<string, ScrapedEntry[]> }).prices;

  const rows: HotDropRow[] = [];

  for (const disc of discs as Disc[]) {
    const entries = prices[disc.id] ?? [];
    if (entries.length === 0) continue;

    // Find best edition — prefer entries with a matching hot-drop keyword
    const hotEntry = entries.find((e) => {
      if (!e.edition) return false;
      const ed = e.edition.toLowerCase();
      return [...ALL_HOT_EDITION_KEYWORDS].some((kw) => ed.includes(kw.toLowerCase()));
    });
    const anyEditionEntry = entries.find((e) => e.edition);
    const bestEditionEntry = hotEntry ?? anyEditionEntry ?? null;
    const edition = bestEditionEntry?.edition ?? null;
    const lastScraped = bestEditionEntry?.lastScraped ?? null;

    const inStockEntries = entries.filter((e) => e.inStock);
    const price = inStockEntries.length
      ? Math.min(...inStockEntries.map((e) => e.price))
      : null;
    const inStock = inStockEntries.length > 0;

    // Only include discs that have an edition (real hot drops only)
    if (!edition) continue;

    const badge = editionToBadge(edition, inStock, lastScraped ?? undefined);

    rows.push({
      id: disc.id,
      name: disc.name,
      brand: disc.brand,
      type: disc.type,
      flight: disc.flight,
      badge,
      edition,
      price,
      inStock,
      image: getDiscImage(disc),
      lastScraped,
    });
  }

  // Sort: 1) in-stock above out-of-stock  2) newest scraped first  3) tour/team series above generic
  const badgeRank: Record<string, number> = { 'tour-series': 3, limited: 2, 'new-drop': 2, hot: 1, 'sold-out': 0 };
  rows.sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    const da = a.lastScraped ?? '';
    const db = b.lastScraped ?? '';
    if (da !== db) return db.localeCompare(da);
    return (badgeRank[b.badge] ?? 0) - (badgeRank[a.badge] ?? 0);
  });

  return rows.slice(0, 6);
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar({
  showMobileSearch,
  onSearchClick,
}: {
  showMobileSearch: boolean;
  onSearchClick: () => void;
}) {
  return (
    <nav className="sticky top-0 z-50 relative flex w-full items-center bg-[#1E3D2F] px-8 py-4 shadow-sm">
      <Link
        href="/"
        className="flex shrink-0 items-center transition-opacity hover:opacity-85"
        style={{ gap: 10 }}
      >
        <Image
          src="/discdrop-logo-dark.svg"
          alt="DiscDrop"
          width={170}
          height={36}
          className="h-[28px] w-auto md:h-[36px]"
        />
      </Link>
      <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 text-sm text-[#9DC08B] md:flex">
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          Hjem
        </a>
        <a href="#hot-drops" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Hot Drops
        </a>
        <Link href="/browse" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Alle disker
        </Link>
        <Link href="/bag/build" className="rounded-full px-3.5 py-1.5 transition-colors duration-200 hover:bg-white/10 hover:text-white">
          Bygg min bag
        </Link>
      </div>
      {/* Mobile search icon — fades in when hero search scrolls out of view */}
      <button
        type="button"
        onClick={onSearchClick}
        aria-label="Søk etter disker"
        className={`flex h-10 w-10 items-center justify-center rounded-full text-[#9DC08B] transition-all duration-200 md:hidden ${
          showMobileSearch
            ? "scale-100 opacity-100"
            : "pointer-events-none scale-90 opacity-0"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </button>
    </nav>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────
function Hero() {
  const [query, setQuery] = useState("");

  return (
    <section className="w-full bg-[#1E3D2F] px-8 pb-20 pt-16 text-center">
      <h1 className="mb-2 font-serif text-[72px] leading-none tracking-tight text-[#F5F2EB]">
        Finn din disk.
      </h1>
      <p className="mb-8 text-sm tracking-[0.2em] text-[#9DC08B]/60">
        Sammenlign · Spar · Spill
      </p>
      <p className="mb-10 text-lg leading-relaxed text-[#9DC08B]">
        Den smarteste måten å finne disken din på i Norge.
        <br />
        Oppdaterte priser. Lageroversikt. Totalpris på disk.
      </p>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Søk etter disker, merker, spillere..."
        className="mx-auto max-w-2xl text-left"
        inputId="hero-search-input"
      />

      <p className="mt-5 text-sm text-[#9DC08B]/70">
        {discs.length} disker · 7 norske butikker · Oppdatert daglig
      </p>
    </section>
  );
}

// ── Hot Drops ──────────────────────────────────────────────────────────────
function HotDrops() {
  const rows = useMemo(() => buildHotDropRows(), []);

  return (
    <section id="hot-drops" className="w-full bg-white px-8 py-16" style={{ scrollMarginTop: "80px" }}>
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 font-serif text-3xl tracking-tight text-[#1a1a1a]">
          Hot Drops
        </h2>
        <p className="mb-8 max-w-xl text-[#666]">
          Limitede runs og tour-plast verdt å følge med på.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/disc/${row.id}`}
              className="flex flex-col rounded-2xl border border-[#e8e8e4] bg-[#fafaf8] p-5 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#2D6A4F]/30 hover:shadow-lg"
            >
              {/* Disc image */}
              <div className="mb-4 flex items-center justify-center rounded-xl bg-[#F5F2EB]" style={{ height: 140 }}>
                <DiscImage src={row.image ?? ""} name={row.name} brand={row.brand} type={row.type} containerStyle={{ height: 140 }} />
              </div>

              {/* Badge */}
              <div className="mb-3">
                <Badge tag={row.badge} />
              </div>

              {/* Name + brand */}
              <h3 className="font-serif text-xl font-semibold leading-tight text-[#1a1a1a]">
                {row.name}
              </h3>
              <p className="mt-0.5 text-sm text-[#666]">{row.brand}</p>

              {/* Edition label */}
              {row.edition && (
                <p className="mt-1.5 text-sm font-medium text-[#2D6A4F]">{row.edition}</p>
              )}

              {/* Flight numbers */}
              <FlightBoxes flight={row.flight} />

              {/* Price + CTA */}
              <div className="mt-auto border-t border-[#e8e8e4] pt-4">
                <p className="text-xs uppercase tracking-wider text-[#888]">Beste pris</p>
                <p className="font-serif text-2xl font-semibold text-[#2D6A4F]">
                  {row.price != null ? `${row.price} kr` : "—"}
                </p>
                <div className="mt-4 w-full rounded-xl bg-[#2D6A4F] py-2.5 text-center text-sm font-medium text-white">
                  Finn disken →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Hvorfor DiscDrop ───────────────────────────────────────────────────────
function WhyDiscDrop() {
  const props = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
          <line x1="11" y1="8" x2="11" y2="14" />
        </svg>
      ),
      heading: "Sammenlign priser",
      text: "Se priser fra alle norske diskgolfbutikker på ett sted. Finn den beste dealen uten å sjekke hver butikk manuelt.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <line x1="7" y1="15" x2="7.01" y2="15" />
          <line x1="11" y1="15" x2="13" y2="15" />
        </svg>
      ),
      heading: "Reell totalpris",
      text: "Vi viser diskpris pluss frakt — så du alltid vet hva du faktisk betaler. Ingen overraskelser.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      heading: "Prisvarsler",
      text: "Sett ønsket pris og få varsel når disken din dropper i pris eller kommer på lager igjen.",
    },
  ];

  return (
    <section className="w-full px-8 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 font-serif text-3xl tracking-tight text-[#1a1a1a]">
          Hvorfor DiscDrop?
        </h2>
        <p className="mb-12 text-[#666]">
          Vi gjør det enkelt å finne riktig disk til riktig pris.
        </p>
        <div className="grid gap-10 sm:grid-cols-3">
          {props.map(({ icon, heading, text }) => (
            <div key={heading} className="flex flex-col gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#2D6A4F]/8">
                {icon}
              </div>
              <div>
                <h3 className="mb-1.5 font-serif text-lg font-semibold text-[#1a1a1a]">
                  {heading}
                </h3>
                <p className="text-sm leading-relaxed text-[#666]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ── Popular discs ───────────────────────────────────────────────────────────
const POPULAR_IDS = [
  "innova-destroyer",
  "discraft-buzzz",
  "kastaplast-berg",
  "innova-aviar",
  "dynamic-judge",
  "latitude-river",
];

function PopularDiscs() {
  const popularDiscs = POPULAR_IDS.map((id) =>
    discs.find((d) => d.id === id)
  ).filter(Boolean) as Disc[];

  return (
    <section className="w-full bg-white px-8 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 font-serif text-3xl tracking-tight text-[#1a1a1a]">
          Populære disker
        </h2>
        <p className="mb-8 text-[#666]">
          Velkjente klassikere å starte søket med.
        </p>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {popularDiscs.map((d) => {
            const price = bestPriceNOK(d);
            return (
              <Link
                key={d.id}
                href={`/disc/${d.id}`}
                className="min-w-[160px] shrink-0 rounded-2xl border border-[#e8e8e4] bg-[#fafaf8] p-4 transition-all hover:-translate-y-0.5 hover:shadow-md sm:min-w-0"
              >
                <div
                  className="mb-3 flex items-center justify-center rounded-xl bg-[#F5F2EB]"
                  style={{ height: 90 }}
                >
                  <DiscImage
                    src={"image" in d ? (d.image as string) : ""}
                    name={d.name}
                    brand={d.brand}
                    type={d.type}
                    containerStyle={{ height: 90 }}
                  />
                </div>
                <h3 className="font-serif text-base font-semibold text-[#1a1a1a]">
                  {d.name}
                </h3>
                <p className="text-xs text-[#666]">{d.brand}</p>
                <p className="mt-2 font-serif text-lg font-semibold text-[#2D6A4F]">
                  {price != null ? `${price} kr` : "—"}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/browse"
            className="inline-block rounded-xl border border-[#2D6A4F] px-7 py-3 text-sm font-medium text-[#2D6A4F] transition-all hover:bg-[#2D6A4F]/5"
          >
            Se alle {discs.length} disker →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function DiscDropHome() {
  const [heroSearchVisible, setHeroSearchVisible] = useState(true);

  useEffect(() => {
    const el = document.getElementById("hero-search-input");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeroSearchVisible(entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function scrollToSearch() {
    const input = document.getElementById(
      "hero-search-input"
    ) as HTMLInputElement | null;
    if (!input) return;
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => input.focus(), 400);
  }

  return (
    <div className="min-h-screen bg-[#F5F2EB]">
      <Navbar
        showMobileSearch={!heroSearchVisible}
        onSearchClick={scrollToSearch}
      />
      <main>
        <Hero />
        <HotDrops />
        <WhyDiscDrop />
        <PopularDiscs />
      </main>
      <footer className="border-t border-[#e0ddd4] bg-[#F5F2EB] px-6 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12px] text-[#999]">
          <span>© 2026 DiscDrop · Laget av <a href="https://kviist.no" target="_blank" rel="noopener noreferrer" className="text-[#2D6A4F] hover:underline">Kviist</a></span>
          <span>Prisene inkluderer 25% MVA. Fraktgrenser varierer.</span>
          <div className="flex gap-4">
            <Link href="/personvern" className="transition-colors hover:text-[#444]">Personvern</Link>
            <a href="mailto:kontakt@discdrop.net" className="transition-colors hover:text-[#444]">kontakt@discdrop.net</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
