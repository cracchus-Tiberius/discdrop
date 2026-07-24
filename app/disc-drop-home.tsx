"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DiscImage } from "@/components/DiscImage";
import { SearchInput } from "@/components/SearchInput";
import { SiteHeader } from "@/components/SiteHeader";
import { discs } from "@/data/discs.js";
import scrapedPrices from "@/data/scraped-prices.json";
import topSellers from "@/data/top-sellers.json";
import { getScrapedPrice, getDiscImage, entryLandedNOK, formatRelativeTime } from "@/lib/disc-utils";

// ── Types ──────────────────────────────────────────────────────────────────
type Disc = (typeof discs)[number];

function bestPriceNOK(disc: Disc): number | null {
  return getScrapedPrice(disc.id).price;
}

// ── Badge ──────────────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  hot: "bg-[#E8704A] text-white",
  new: "bg-[#B8E04A] text-[#101C14]",
  "new-drop": "bg-[#B8E04A] text-[#101C14]",
  limited: "bg-[#E8704A] text-white",
  "first-run": "bg-[#101C14] text-[#B8E04A]",
  "tour-series": "bg-[#B8E04A] text-[#101C14]",
  "sold-out": "bg-[#888] text-white",
};

const BADGE_LABELS: Record<string, string> = {
  hot: "HOT",
  new: "NY",
  "new-drop": "NY",
  limited: "LIMITED",
  "first-run": "FIRST RUN",
  "tour-series": "TOUR SERIES",
  "sold-out": "UTSOLGT",
};

function Badge({ tag }: { tag: string }) {
  return (
    <span
      className={`inline-flex w-fit -rotate-2 items-center rounded-lg px-2.5 py-1 text-[11px] font-extrabold tracking-wide shadow-[2px_2px_0_#101C14] ${BADGE_STYLES[tag] ?? "bg-gray-200 text-gray-700"}`}
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
    <div className="mt-3 flex gap-1.5">
      {cells.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-[#F1EFE6] py-2"
        >
          <div className="text-lg font-extrabold text-[#101C14]">{value}</div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-[#101C1488]">{label}</div>
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
function editionToBadge(edition: string | null, inStock: boolean, firstSeen?: string): string {
  if (!inStock) return 'sold-out';

  // Edition type takes priority over recency — classify first
  if (edition) {
    const ed = edition.toLowerCase();
    if (TOUR_SERIES_KEYWORDS.some((kw) => ed.includes(kw.toLowerCase()))) return 'tour-series';
    if (HOT_PLAYER_NAMES.some((p) => ed.includes(p.toLowerCase()))) return 'tour-series';
    if (['first run', 'primal run'].some((kw) => ed.includes(kw))) return 'first-run';
    if (LIMITED_KEYWORDS.some((kw) => ed.includes(kw.toLowerCase()))) return 'limited';
  }

  // Event/tournament editions are limited runs — show as limited
  // Generic edition that genuinely just showed up → new-drop. Uses firstSeen
  // (set once, never overwritten) rather than lastScraped, which now bumps
  // on every single scrape run and would otherwise make everything "new".
  if (firstSeen) {
    const ageMs = Date.now() - new Date(firstSeen).getTime();
    if (ageMs < 14 * 24 * 60 * 60 * 1000) return 'new-drop';
  }
  return 'limited';
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
  storeCount: number;
  image: string;
  lastScraped: string | null;
  premiumRatio: number;
};

const BRAND_PRIORITY = [
  'Kastaplast', 'Discmania', 'Innova', 'MVP', 'Axiom',
  'Dynamic Discs', 'Latitude 64', 'Discraft', 'Prodigy',
];

function buildHotDropRows(): HotDropRow[] {
  type ScrapedEntry = { store: string; price: number; inStock: boolean; url: string; edition?: string | null; lastScraped: string; firstSeen?: string };
  const prices = (scrapedPrices as { prices: Record<string, ScrapedEntry[]> }).prices;
  const storeMeta = scrapedPrices.stores as Record<string, Parameters<typeof entryLandedNOK>[1]>;

  const rows: HotDropRow[] = [];

  for (const disc of discs as Disc[]) {
    if (disc.brand === "Alfa") continue;
    const entries = prices[disc.id] ?? [];
    if (entries.length === 0) continue;

    // Find ALL entries matching a hot-drop edition keyword (tour/player/limited).
    // The card's headline price must come from a hot entry, not from the
    // cheapest-overall — otherwise the badge says "Tour Series" but the price
    // belongs to the DX baseline plastic.
    const hotEntries = entries.filter((e) => {
      if (!e.edition) return false;
      const ed = e.edition.toLowerCase();
      return [...ALL_HOT_EDITION_KEYWORDS].some((kw) => ed.includes(kw.toLowerCase()));
    });
    if (hotEntries.length === 0) continue;

    // Cheapest in-stock hot entry wins the card. Falls back to first hot
    // entry (out-of-stock) just to keep the badge.
    const inStockHot = hotEntries.filter((e) => e.inStock && e.price >= 50);
    const winner = inStockHot.length > 0
      ? inStockHot.reduce((a, b) => entryLandedNOK(a, storeMeta[a.store]) <= entryLandedNOK(b, storeMeta[b.store]) ? a : b)
      : hotEntries[0];

    const edition = winner.edition ?? null;
    const lastScraped = winner.lastScraped ?? null;
    const firstSeen = winner.firstSeen ?? null;
    const price = inStockHot.length > 0 ? entryLandedNOK(winner, storeMeta[winner.store]) : null;
    const inStock = inStockHot.length > 0;
    const storeCount = new Set(inStockHot.map((e) => e.store)).size;

    // Price premium vs. the disc's overall cheapest in-stock price: a special
    // edition that costs much more than the baseline plastic is a stronger
    // "this is genuinely special" signal than one that costs about the same.
    const allInStock = entries.filter((e) => e.inStock && e.price >= 50);
    const basePrice = allInStock.length > 0
      ? Math.min(...allInStock.map((e) => entryLandedNOK(e, storeMeta[e.store])))
      : null;
    const premiumRatio = price != null && basePrice ? price / basePrice : 1;

    const badge = editionToBadge(edition, inStock, firstSeen ?? undefined);

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
      storeCount,
      image: getDiscImage(disc),
      lastScraped,
      premiumRatio,
    });
  }

  // Sort: 1) in-stock first  2) badge rank (tour > first-run > limited > new > hot)
  //       3) scarcity (fewer stores = more exclusive)  4) price premium
  //       5) brand priority  6) recency
  const badgeRank: Record<string, number> = {
    'tour-series': 5, 'first-run': 4, limited: 3, 'new-drop': 2, hot: 1, 'sold-out': 0,
  };
  rows.sort((a, b) => {
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    const rankDiff = (badgeRank[b.badge] ?? 0) - (badgeRank[a.badge] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    if (a.storeCount !== b.storeCount) return a.storeCount - b.storeCount;
    if (Math.abs(a.premiumRatio - b.premiumRatio) > 0.05) return b.premiumRatio - a.premiumRatio;
    // Within same badge/rarity/premium: brand priority
    const aP = BRAND_PRIORITY.indexOf(a.brand); const bP = BRAND_PRIORITY.indexOf(b.brand);
    const aBP = aP === -1 ? 999 : aP; const bBP = bP === -1 ? 999 : bP;
    if (aBP !== bBP) return aBP - bBP;
    return (b.lastScraped ?? '').localeCompare(a.lastScraped ?? '');
  });

  // Brand diversity: max 2 per brand, greedy pick in badge+priority order
  const brandCount: Record<string, number> = {};
  const selected: HotDropRow[] = [];
  for (const row of rows) {
    if (selected.length >= 6) break;
    const count = brandCount[row.brand] ?? 0;
    if (count >= 2) continue;
    brandCount[row.brand] = count + 1;
    selected.push(row);
  }

  return selected;
}

// ── Latest Drops ─────────────────────────────────────────────────────────────
// Distinct from Hot Drops: not filtered by edition keywords at all — this is
// purely "what genuinely just showed up", using firstSeen (set once per price
// entry, never overwritten). Surfaces ordinary restocks and new plastic runs
// that Hot Drops' tour-series/player-edition filter would otherwise miss.

type LatestDropRow = {
  id: string;
  name: string;
  brand: string;
  type: string;
  flight: Flight;
  price: number;
  storeCount: number;
  image: string;
  firstSeen: string;
  plastic: string | null;
};

const LATEST_DROP_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function buildLatestDropRows(): LatestDropRow[] {
  type ScrapedEntry = { store: string; price: number; inStock: boolean; url: string; plastic?: string | null; firstSeen?: string; lastScraped: string };
  const prices = (scrapedPrices as { prices: Record<string, ScrapedEntry[]> }).prices;
  const storeMeta = scrapedPrices.stores as Record<string, Parameters<typeof entryLandedNOK>[1]>;
  const cutoff = Date.now() - LATEST_DROP_MAX_AGE_MS;

  const rows: LatestDropRow[] = [];

  for (const disc of discs as Disc[]) {
    if (disc.brand === "Alfa") continue;
    const entries = (prices[disc.id] ?? []).filter(
      (e) => e.inStock && e.price >= 50 && e.firstSeen && new Date(e.firstSeen).getTime() >= cutoff
    );
    if (entries.length === 0) continue;

    // Most-recently-appeared entry represents this disc's card
    const newest = entries.reduce((a, b) => (a.firstSeen! > b.firstSeen! ? a : b));

    rows.push({
      id: disc.id,
      name: disc.name,
      brand: disc.brand,
      type: disc.type,
      flight: disc.flight,
      price: entryLandedNOK(newest, storeMeta[newest.store]),
      storeCount: new Set(entries.map((e) => e.store)).size,
      image: getDiscImage(disc),
      firstSeen: newest.firstSeen!,
      plastic: newest.plastic ?? null,
    });
  }

  rows.sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));

  // Brand diversity, same pattern as Hot Drops
  const brandCount: Record<string, number> = {};
  const selected: LatestDropRow[] = [];
  for (const row of rows) {
    if (selected.length >= 6) break;
    const count = brandCount[row.brand] ?? 0;
    if (count >= 2) continue;
    brandCount[row.brand] = count + 1;
    selected.push(row);
  }

  return selected;
}

// ── Hero ───────────────────────────────────────────────────────────────────
const HERO_DISC_IDS = topSellers.discs
  .filter((d) => d.catalogId !== null)
  .slice(0, 2)
  .map((d) => d.catalogId as string);

function Hero() {
  const [query, setQuery] = useState("");
  const storeCount = Object.keys(scrapedPrices.stores).length;
  const heroDiscs = HERO_DISC_IDS.map((id) => discs.find((d) => d.id === id)).filter(Boolean) as Disc[];

  return (
    <section className="w-full bg-[#FFFDF6] px-5 pb-16 pt-10 md:px-10 md:pb-20 md:pt-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <span className="dd-sticker">{discs.length} disker sjekket i dag ✓</span>
          <h1 className="mt-4 text-[44px] font-extrabold leading-[0.98] tracking-tight text-[#101C14] md:text-[72px]">
            Riktig disk.
            <br />
            <span
              style={{ backgroundImage: "linear-gradient(transparent 62%, #B8E04A 62%)" }}
            >
              Riktig pris.
            </span>
          </h1>
          <p className="mb-8 mt-4 max-w-[46ch] text-base leading-relaxed text-[#101C14]/70 md:text-lg">
            Norges prissammenligning for diskgolf. Vi sjekker prisene i {storeCount} butikker hver morgen — totalpris med frakt, alltid.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:max-w-xl">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Søk etter disker, merker, spillere …"
              className="flex-1 text-left"
              inputId="hero-search-input"
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="dd-sticker -rotate-1">{discs.length} disker</span>
            <span className="-rotate-1 rounded-lg border-2 border-[#101C14] bg-white px-2.5 py-1.5 text-xs font-extrabold text-[#101C14] shadow-[2px_2px_0_#101C14]">
              {storeCount} butikker
            </span>
          </div>
        </div>

        <div className="relative hidden h-72 md:block">
          {heroDiscs[0] && (
            <div className="absolute right-16 top-2 h-52 w-52 overflow-hidden rounded-full border-2 border-[#101C14] bg-[#F1EFE6] shadow-[6px_6px_0_#B8E04A]">
              <DiscImage
                src={getDiscImage(heroDiscs[0])}
                name={heroDiscs[0].name}
                brand={heroDiscs[0].brand}
                type={heroDiscs[0].type}
                fit="cover"
              />
            </div>
          )}
          {heroDiscs[1] && (
            <div className="absolute right-0 top-32 h-40 w-40 overflow-hidden rounded-full border-2 border-[#101C14] bg-[#F6F8EA] shadow-[5px_5px_0_#101C14]">
              <DiscImage
                src={getDiscImage(heroDiscs[1])}
                name={heroDiscs[1].name}
                brand={heroDiscs[1].brand}
                type={heroDiscs[1].type}
                fit="cover"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Hot Drops ──────────────────────────────────────────────────────────────
function HotDrops() {
  const rows = useMemo(() => buildHotDropRows(), []);

  return (
    <section id="hot-drops" className="w-full border-y-2 border-[#101C14] bg-[#FFFDF6] px-5 py-14 md:px-10 md:py-16" style={{ scrollMarginTop: "72px" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#101C14] md:text-3xl">
            Hot Drops
          </h2>
          <Link href="/browse" className="text-sm font-bold text-[#101C14] underline decoration-[#B8E04A] decoration-2 underline-offset-4">
            Se alle disker →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/disc/${row.id}`}
              className="flex flex-col gap-3 rounded-2xl border-2 border-[#101C14] bg-white p-4 shadow-[4px_4px_0_#B8E04A] transition-transform duration-150 ease-out hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[7px_7px_0_#B8E04A]"
            >
              <div className="flex items-start justify-between gap-2">
                <Badge tag={row.badge} />
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1EFE6]">
                  <DiscImage src={row.image ?? ""} name={row.name} brand={row.brand} type={row.type} fit="cover" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-extrabold leading-tight text-[#101C14]">
                  {row.name}
                </h3>
                <p className="text-sm text-[#101C1499]">
                  {row.brand}{row.edition ? ` · ${row.edition}` : ""}
                </p>
              </div>

              <FlightBoxes flight={row.flight} />

              <div className="mt-auto flex items-center justify-between gap-3 border-t-2 border-[#F1EFE6] pt-3">
                <div>
                  <p className="text-xl font-extrabold text-[#101C14]">
                    {row.price != null ? `${row.price},-` : "—"}
                  </p>
                  <p className="text-[11px] text-[#101C1477]">inkl. frakt · {row.storeCount} {row.storeCount === 1 ? "butikk" : "butikker"}</p>
                </div>
                <span className="dd-cta px-4 py-2 text-sm">Se pris</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function LatestDrops() {
  const rows = useMemo(() => buildLatestDropRows(), []);
  if (rows.length === 0) return null;

  return (
    <section id="latest-drops" className="w-full border-b-2 border-[#101C14] bg-[#FFFDF6] px-5 py-14 md:px-10 md:py-16" style={{ scrollMarginTop: "72px" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#101C14] md:text-3xl">
            Siste drops
          </h2>
          <Link href="/browse" className="text-sm font-bold text-[#101C14] underline decoration-[#B8E04A] decoration-2 underline-offset-4">
            Se alle disker →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/disc/${row.id}`}
              className="flex flex-col gap-3 rounded-2xl border-2 border-[#101C14] bg-white p-4 shadow-[4px_4px_0_#101C14] transition-transform duration-150 ease-out hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[7px_7px_0_#101C14]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="dd-sticker -rotate-2 text-[11px]" style={{ background: "#B8E04A", color: "#101C14" }}>
                  NYTT
                </span>
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#F1EFE6]">
                  <DiscImage src={row.image ?? ""} name={row.name} brand={row.brand} type={row.type} fit="cover" />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-extrabold leading-tight text-[#101C14]">
                  {row.name}
                </h3>
                <p className="text-sm text-[#101C1499]">
                  {row.brand}{row.plastic ? ` · ${row.plastic}` : ""}
                </p>
              </div>

              <FlightBoxes flight={row.flight} />

              <div className="mt-auto flex items-center justify-between gap-3 border-t-2 border-[#F1EFE6] pt-3">
                <div>
                  <p className="text-xl font-extrabold text-[#101C14]">
                    {row.price},-
                  </p>
                  <p className="text-[11px] text-[#101C1477]">{formatRelativeTime(row.firstSeen)}</p>
                </div>
                <span className="dd-cta px-4 py-2 text-sm">Se pris</span>
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
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#101C14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#101C14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#101C14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
      heading: "Prisvarsler",
      text: "Sett ønsket pris og få varsel når disken din dropper i pris eller kommer på lager igjen.",
    },
  ];

  return (
    <section className="w-full px-5 py-14 md:px-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-[#101C14] md:text-3xl">
          Hvorfor DiscDrop?
        </h2>
        <p className="mb-10 text-[#101C1499]">
          Vi gjør det enkelt å finne riktig disk til riktig pris.
        </p>
        <div className="grid gap-8 sm:grid-cols-3">
          {props.map(({ icon, heading, text }) => (
            <div key={heading} className="flex flex-col gap-3 rounded-2xl border-2 border-[#101C14] bg-white p-5 shadow-[3px_3px_0_#B8E04A]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1EFE6]">
                {icon}
              </div>
              <div>
                <h3 className="mb-1 text-base font-extrabold text-[#101C14]">
                  {heading}
                </h3>
                <p className="text-sm leading-relaxed text-[#101C1499]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


// ── Popular discs ───────────────────────────────────────────────────────────
const POPULAR_IDS = topSellers.discs
  .filter((d) => d.catalogId !== null)
  .slice(0, 12)
  .map((d) => d.catalogId as string);

function PopularDiscs() {
  const popularDiscs = POPULAR_IDS.map((id) =>
    discs.find((d) => d.id === id)
  ).filter(Boolean) as Disc[];

  return (
    <section className="w-full border-t-2 border-[#101C14] bg-[#FFFDF6] px-5 py-14 md:px-10 md:py-16">
      <div className="mx-auto max-w-6xl">
        <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-[#101C14] md:text-3xl">
          Populære disker
        </h2>
        <p className="mb-8 text-[#101C1499]">
          Velkjente klassikere å starte søket med.
        </p>

        {/* Horizontal scroll on mobile, grid on desktop */}
        <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
          {popularDiscs.map((d) => {
            const price = bestPriceNOK(d);
            return (
              <Link
                key={d.id}
                href={`/disc/${d.id}`}
                className="min-w-[130px] shrink-0 rounded-xl border-2 border-[#101C14] bg-white p-3 transition-transform duration-150 hover:-translate-y-0.5 hover:-translate-x-0.5 hover:shadow-[3px_3px_0_#B8E04A] sm:min-w-0"
              >
                <div
                  className="mb-2 overflow-hidden rounded-lg bg-[#F1EFE6]"
                  style={{ height: 70 }}
                >
                  <DiscImage
                    src={getDiscImage(d)}
                    name={d.name}
                    brand={d.brand}
                    type={d.type}
                    fit="cover"
                  />
                </div>
                <h3 className="text-sm font-extrabold leading-tight text-[#101C14]">
                  {d.name}
                </h3>
                <p className="text-[11px] text-[#101C1499]">{d.brand}</p>
                <p className="mt-1 text-base font-extrabold text-[#101C14]">
                  {price != null ? `${price} kr` : "—"}
                </p>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link href="/browse" className="dd-cta px-6 py-3 text-sm">
            Se alle {discs.length} disker →
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function DiscDropHome() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DiscDrop",
    "url": "https://discdrop.net",
    "logo": {
      "@type": "ImageObject",
      "url": "https://discdrop.net/og.png",
    },
    "description": "Sammenlign diskgolfpriser fra norske butikker. Oppdatert daglig.",
  };

  return (
    <div className="min-h-screen bg-[#FFFDF6]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteHeader />
      <main>
        <Hero />
        <HotDrops />
        <LatestDrops />
        <WhyDiscDrop />
        <PopularDiscs />
      </main>
      <footer className="border-t-2 border-[#101C14] bg-[#101C14] px-5 py-6 text-[#FFFDF6] md:px-10">
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
    </div>
  );
}
