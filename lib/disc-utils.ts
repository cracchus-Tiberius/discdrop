import {
  discs,
} from "@/data/discs.js";
import scrapedPrices from "@/data/scraped-prices.json";
import discImages from "@/data/disc-images.json";
import topSellers from "@/data/top-sellers.json";

export type Disc = (typeof discs)[number];

type ScrapedEntry = {
  store: string;
  price: number;
  inStock: boolean;
  url: string;
  image?: string | null;
  lastScraped: string;
  plastic?: string | null;
  edition?: string | null;
  firstSeen?: string;
};

type StoreMeta = {
  name: string;
  url: string;
  freeShippingOver?: number;
  shipping: number;
  country?: string;
  currency?: string;
  voec?: boolean;
};

/**
 * Landed cost: disc price, plus shipping unless this store's freeShippingOver
 * threshold is met by the price alone. International stores never define
 * freeShippingOver (see scripts/stores.config.js's STORE_CONFIGS), so they
 * always get shipping added — matching that they don't offer a domestic-style
 * free-shipping tier. Previously this only added shipping for non-Norwegian
 * stores, treating every Norwegian store's single-disc order as if it always
 * qualified for free shipping — wrong for the common case where one disc's
 * price sits well under an 700-900 kr threshold, which understated "best
 * price" sitewide and directly contradicted the "reell totalpris" promise on
 * the homepage. This function is the single source of truth for that
 * calculation now — the disc detail page's price table (app/disc/[slug]/
 * DiscDetailClient.tsx) used to duplicate an equivalent (and here, more
 * correct) formula inline; it now calls this instead.
 */
export function entryLandedNOK(
  entry: { price: number },
  meta: { freeShippingOver?: number; shipping?: number } | undefined
): number {
  if (!meta) return entry.price;
  if (meta.freeShippingOver != null && entry.price >= meta.freeShippingOver) {
    return entry.price;
  }
  return entry.price + (meta.shipping ?? 0);
}

// Defense against scraper currency bugs (e.g. Discexpress USD-as-SEK incident).
// No legitimate new disc retails for under 50 NOK in any Norwegian or
// VOEC-imported context. Filter at the data-access layer so HotDrops, the disc
// detail price table, search ordering, etc. all share one floor.
export const MIN_VALID_PRICE_NOK = 50;

// Defense against accessory/gear mismatches (e.g. a bag or rangefinder whose
// title happens to contain a generic mold name like "Shift" or "Range"
// matching to that disc — confirmed in production: "Upper Park - The Shift"
// bag matched mvp-shift at 2344 kr, "Range Finder Lite" matched
// streamline-range at 997 kr). No real single disc retails above ~600 kr, even
// rare Tour Series/signature editions. Same data-access-layer pattern as
// MIN_VALID_PRICE_NOK. Rejected entries are logged daily by
// scripts/audit-price-caps.js -> data/rejected-prices.json so a genuinely
// expensive limited-run disc doesn't just silently vanish — spot-check that
// file if a disc's price looks suspiciously absent.
export const MAX_VALID_PRICE_NOK = 600;

/**
 * Returns price/stock data from scraped-prices.json for a disc ID.
 * Price is landed cost in NOK: disc + mandatory shipping for international stores.
 * Returns nulls/zeros if no scraped data exists for that disc.
 */
export function getScrapedPrice(discId: string): {
  price: number | null;
  inStockCount: number;
  storeCount: number;
} {
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[discId];
  if (!scraped || scraped.length === 0) {
    return { price: null, inStockCount: 0, storeCount: 0 };
  }
  const storeMeta = scrapedPrices.stores as Record<string, StoreMeta>;
  const inStock = scraped.filter(
    (s) => s.inStock && s.price >= MIN_VALID_PRICE_NOK && s.price <= MAX_VALID_PRICE_NOK
  );
  return {
    price: inStock.length
      ? Math.min(...inStock.map((s) => entryLandedNOK(s, storeMeta[s.store])))
      : null,
    inStockCount: new Set(inStock.map((s) => s.store)).size,
    storeCount: new Set(scraped.map((s) => s.store)).size,
  };
}

/**
 * Returns ONLY real scraped stores for a disc, shaped for the PriceTable.
 * Returns empty array if no scraped data exists — do NOT fall back to mock data.
 */
/** ISO timestamp of last scrape, or null if never scraped */
export const scrapedLastUpdated: string | null = scrapedPrices.lastUpdated as string | null;

/** Most recent lastScraped ISO string for a disc, or null if no scrape data */
export function getDiscLastScraped(discId: string): string | null {
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[discId];
  if (!scraped || scraped.length === 0) return null;
  const dates = scraped.map((e) => e.lastScraped).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort().at(-1) ?? null;
}

/** Earliest firstSeen ISO string for a disc across all store listings, or null if unknown. */
export function getDiscFirstSeen(discId: string): string | null {
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[discId];
  if (!scraped || scraped.length === 0) return null;
  const dates = scraped.map((e) => e.firstSeen).filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort()[0] ?? null;
}

// Same threshold app/disc-drop-home.tsx uses for its "new-drop" badge — kept
// in sync so a disc reads as "new" identically on the homepage and on the
// browse/all-discs grid instead of two independently-tuned cutoffs drifting
// apart over time.
const NEW_DROP_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * True if this disc first showed up in scraped data within the last 14 days.
 * Replaces the old approach of manually adding "new"/"new-drop" to a disc's
 * tags array in discs.js — that never got updated when the scraper actually
 * picked up a new listing, so the browse page's "Nye drop" filter and badge
 * silently went stale (confirmed in production 2026-08-17: it only ever
 * reflected whatever a human had hand-tagged, not real scrape recency).
 */
export function isNewDrop(discId: string): boolean {
  const firstSeen = getDiscFirstSeen(discId);
  if (!firstSeen) return false;
  const asOf = scrapedLastUpdated ? new Date(scrapedLastUpdated).getTime() : Date.now();
  return asOf - new Date(firstSeen).getTime() < NEW_DROP_MAX_AGE_MS;
}

// data/top-sellers.json is already a real, periodically-refreshed signal
// (scripts/scrape-top-sellers.js, ~every 14 days) of which discs are
// actually popular right now — reusing it for the "Hot" badge means that
// badge tracks real demand too, instead of another hand-maintained tag.
const HOT_DISC_IDS = new Set(
  (topSellers.discs as { catalogId?: string }[]).map((d) => d.catalogId).filter(Boolean)
);

/** True if this disc is on the current top-sellers list (see data/top-sellers.json). */
export function isHotDisc(discId: string): boolean {
  return HOT_DISC_IDS.has(discId);
}

// Precomputed once at module load: discId -> distinct plastic names seen
// across all store listings. Powers plastic-name search (e.g. "Jawbreaker")
// without rescanning scraped-prices.json on every keystroke.
const DISC_PLASTICS_MAP: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const [discId, entries] of Object.entries(
    scrapedPrices.prices as Record<string, ScrapedEntry[]>
  )) {
    const set = new Set<string>();
    for (const e of entries) if (e.plastic) set.add(e.plastic);
    if (set.size) out[discId] = [...set];
  }
  return out;
})();

/** Distinct plastic names seen across store listings for a disc, e.g. ["Jawbreaker", "Z"]. */
export function getDiscPlastics(discId: string): string[] {
  return DISC_PLASTICS_MAP[discId] ?? [];
}

export type RichStoreEntry = {
  storeName: string;
  storeKey: string;
  price: number;
  inStock: boolean;
  url: string;
  shipping: number;
  freeShippingOver: number;
  plastic: string | null;
  edition: string | null;
  image?: string | null;
  country?: string;
  voec?: boolean;
};

/**
 * Returns all scraped entries for a disc, enriched with store meta + variant info.
 * Used by the variant-aware price section on the disc detail page.
 */
export function getAllScrapedEntries(discId: string): RichStoreEntry[] {
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[discId];
  if (!scraped || scraped.length === 0) return [];
  const valid = scraped.filter((e) => e.price >= MIN_VALID_PRICE_NOK && e.price <= MAX_VALID_PRICE_NOK);
  if (valid.length === 0) return [];
  const storeMeta = scrapedPrices.stores as Record<string, StoreMeta>;
  return valid.map((entry) => {
    const meta = storeMeta[entry.store];
    return {
      storeName: meta?.name ?? entry.store,
      storeKey: entry.store,
      price: entry.price,
      inStock: entry.inStock,
      url: entry.url,
      shipping: meta?.shipping ?? 45,
      freeShippingOver: meta?.freeShippingOver ?? 999,
      plastic: entry.plastic ?? null,
      edition: entry.edition ?? null,
      image: entry.image,
      country: meta?.country,
      voec: meta?.voec,
    };
  });
}

// Product photos of unstamped "blank" discs (no printed design — just a
// plain-colored disc) are real images but poor representative photos.
// Store scrapes don't preserve the original product name on each price
// entry, so we detect these via the image filename, which store product
// photo naming conventions consistently flag (e.g. "Neutron-Trail-Blank-WR").
const BLANK_IMAGE_PATTERN = /\bblank\b/i;

/**
 * Resolves the best available image for a disc using this priority:
 * 1. disc.image from discs.js
 * 2. disc-images.json (Infinite Discs enrichment)
 * 3. image from scraped-prices.json (Norwegian store scrape) — preferring a
 *    stamped photo over an unstamped "blank" one when both are available
 * 4. /disc-placeholder.svg
 */
export function getDiscImage(disc: Disc): string {
  if ("image" in disc && disc.image) return disc.image as string;
  const enriched = (discImages as Record<string, string>)[disc.id];
  if (enriched) return enriched;
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[disc.id];
  if (scraped) {
    let fallbackBlank: string | null = null;
    for (const entry of scraped) {
      if (!entry.image) continue;
      if (BLANK_IMAGE_PATTERN.test(entry.image)) {
        if (!fallbackBlank) fallbackBlank = entry.image;
        continue;
      }
      return entry.image;
    }
    if (fallbackBlank) return fallbackBlank;
  }
  return "/disc-placeholder.svg";
}

/** "for 2 dager siden" / "akkurat nå" style relative time, Norwegian */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "akkurat nå";
  if (hours === 1) return "for 1 time siden";
  if (hours < 24) return `for ${hours} timer siden`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "for 1 dag siden" : `for ${days} dager siden`;
}

/** "YYYY-MM-DD" for a Date in Europe/Oslo — used only to compare calendar days, not for display. */
function osloDayString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * "i dag kl. 13:44" / "i går kl. 13:44" / "31. august kl. 13:44" — Norway-
 * calendar-day-aware, not a fixed elapsed-time duration. Must be called with
 * a real client-side `now` (defaults to `new Date()`, i.e. call this from a
 * client component after mount) — the site is a static export, so "i dag"
 * baked in at build/scrape time goes stale and stays stale on the live page
 * until the next deploy, however long that takes. Confirmed in production
 * 2026-09-02: a delayed scheduled scrape meant "i dag kl. 13:44" was still
 * showing a full day later, because that string was rendered once, at
 * build time, and never revisited.
 */
export function formatCheckedAtLabel(iso: string, now: Date = new Date()): string {
  const scraped = new Date(iso);
  const time = new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" }).format(scraped);

  const scrapedDay = osloDayString(scraped);
  const nowDay = osloDayString(now);
  if (scrapedDay === nowDay) return `i dag kl. ${time}`;

  // Yesterday, computed from nowDay's own Y-M-D components (not by
  // subtracting a raw 24h in ms from `now`) so a DST transition can't shift
  // the comparison onto the wrong calendar day.
  const [ny, nm, nd] = nowDay.split("-").map(Number);
  const yesterday = new Date(Date.UTC(ny, nm - 1, nd - 1));
  if (scrapedDay === osloDayString(yesterday)) return `i går kl. ${time}`;

  const dateStr = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", timeZone: "Europe/Oslo" }).format(scraped);
  return `${dateStr} kl. ${time}`;
}
