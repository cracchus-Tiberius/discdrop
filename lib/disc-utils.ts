import {
  discs,
} from "@/data/discs.js";
import scrapedPrices from "@/data/scraped-prices.json";
import discImages from "@/data/disc-images.json";

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
 * For international (non-Norwegian) stores, shipping is always required — no free-shipping
 * threshold. Returns disc price + shipping. For Norwegian stores returns disc price only
 * (shipping is conditional on basket total, MVA already included in listed price).
 */
function entryLandedNOK(entry: ScrapedEntry, meta: StoreMeta | undefined): number {
  if (meta?.country && meta.country !== "NO") {
    return entry.price + (meta.shipping ?? 0);
  }
  return entry.price;
}

// Defense against scraper currency bugs (e.g. Discexpress USD-as-SEK incident).
// No legitimate new disc retails for under 50 NOK in any Norwegian or
// VOEC-imported context. Filter at the data-access layer so HotDrops, the disc
// detail price table, search ordering, etc. all share one floor.
const MIN_VALID_PRICE_NOK = 50;

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
  const inStock = scraped.filter((s) => s.inStock && s.price >= MIN_VALID_PRICE_NOK);
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
export function getMergedStores(disc: Disc): Array<{
  name: string;
  url: string;
  price: number;
  inStock: boolean;
  shipping: number;
  freeShippingOver: number;
}> {
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[disc.id];
  if (!scraped || scraped.length === 0) return [];

  const valid = scraped.filter((e) => e.price >= MIN_VALID_PRICE_NOK);
  if (valid.length === 0) return [];

  const storeMeta = scrapedPrices.stores as Record<string, StoreMeta>;

  return valid.map((entry) => {
    const meta = storeMeta[entry.store];
    return {
      name: meta?.name ?? entry.store,
      url: entry.url,
      price: entry.price,
      inStock: entry.inStock,
      shipping: meta?.shipping ?? 45,
      freeShippingOver: meta?.freeShippingOver ?? 999,
    };
  });
}

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
  const valid = scraped.filter((e) => e.price >= MIN_VALID_PRICE_NOK);
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

/**
 * Resolves the best available image for a disc using this priority:
 * 1. disc.image from discs.js
 * 2. disc-images.json (Infinite Discs enrichment)
 * 3. image from scraped-prices.json (Norwegian store scrape)
 * 4. /disc-placeholder.svg
 */
export function getDiscImage(disc: Disc): string {
  if ("image" in disc && disc.image) return disc.image as string;
  const enriched = (discImages as Record<string, string>)[disc.id];
  if (enriched) return enriched;
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[disc.id];
  if (scraped) {
    for (const entry of scraped) {
      if (entry.image) return entry.image;
    }
  }
  return "/disc-placeholder.svg";
}

export function getBestInStockNOK(disc: Disc): {
  best: number | null;
  storeCount: number;
  inStockCount: number;
} {
  const { price, storeCount, inStockCount } = getScrapedPrice(disc.id);
  return { best: price, storeCount, inStockCount };
}

export function isOnSale(disc: Disc): boolean {
  const { best } = getBestInStockNOK(disc);
  if (best == null) return false;
  let peak = 0;
  for (const p of disc.priceHistory) {
    if (typeof p === "number" && p > peak) peak = p;
  }
  if (peak === 0) return false;
  return best > 0 && best < peak;
}

export function matchesSearch(disc: Disc, q: string): boolean {
  if (!q.trim()) return false;
  const s = q.toLowerCase();
  const playerMatch =
    "player" in disc && disc.player
      ? disc.player.toLowerCase().includes(s)
      : false;
  return (
    disc.name.toLowerCase().includes(s) ||
    disc.brand.toLowerCase().includes(s) ||
    playerMatch
  );
}

const TOUR_SERIES_KW = ['tour series', 'team series', 'team championship series', 'signature series', 'mold team'];
const FIRST_RUN_KW = ['first run', 'primal run'];
const LIMITED_KW = ['limited edition', 'special edition', 'prototype', 'project lab coat', 'lab coat'];
const PLAYER_NAMES_KW = [
  'eagle mcmahon', 'calvin heimburg', 'ricky wysocki', 'simon lizotte', 'paige pierce',
  'brodie smith', 'paul mcbeth', 'niklas anttila', 'bradley williams', 'gannon buhr',
  'clay edwards', 'casey white', 'nate sexton', 'anthony barela', 'catrina allen',
  'henna blomroos', 'eveliina salonen', 'vaino makela', 'kristofer hivju', 'albert tamm',
  'kristin lätt', 'kristin tattar', 'johne mccray', 'dallas garber', 'joseph anderson',
  'silva saarinen', 'sockibomb', 'jeremy koling', 'james conrad', 'kona montgomery',
  'ida emilie nesse', 'anniken steen', 'julia fors', 'juliana korver', 'josef berg',
  'cadence burge', 'kyle klein', 'aaron gossage', 'holyn handley', 'ella hansen',
  'isaac robinson', 'chris dickerson', 'adam hammes', 'silas schultz',
];

function editionToBadgeLabel(edition: string): string | null {
  const ed = edition.toLowerCase();
  if (TOUR_SERIES_KW.some((kw) => ed.includes(kw))) return "Tour Series";
  if (PLAYER_NAMES_KW.some((p) => ed.includes(p))) return "Tour Series";
  if (FIRST_RUN_KW.some((kw) => ed.includes(kw))) return "First Run";
  if (LIMITED_KW.some((kw) => ed.includes(kw))) return "Limited";
  return null;
}

export function releaseBadge(disc: Disc): string | null {
  const { inStockCount } = getScrapedPrice(disc.id);
  const tags = disc.tags as string[];

  if (tags.includes("sold-out") || inStockCount === 0) return "Sold Out";

  // Derive badge from scraped edition field
  const entries = getAllScrapedEntries(disc.id);
  for (const entry of entries) {
    if (!entry.edition) continue;
    const label = editionToBadgeLabel(entry.edition);
    if (label) return label;
  }

  // Fall back to explicit manual tags
  if (tags.includes("limited")) return "Limited";
  if (tags.includes("first-run")) return "First Run";
  if (tags.includes("tour-series")) return "Tour Series";
  if (tags.includes("new") || tags.includes("new-drop")) return "New Drop";

  return null;
}

export function badgeStyles(kind: string | null): string {
  switch (kind) {
    case "Sold Out":
      return "bg-white/10 text-muted";
    case "Limited":
      return "bg-alert/20 text-alert";
    case "First Run":
      return "bg-red-700/20 text-red-400";
    case "Tour Series":
      return "bg-accent/20 text-accent";
    case "New Drop":
      return "bg-accent/10 text-accent";
    default:
      return "bg-accent/10 text-accent";
  }
}

export const TABS = [
  { id: "all" as const, label: "All" },
  { id: "driver" as const, label: "Drivers" },
  { id: "midrange" as const, label: "Mid-range" },
  { id: "putter" as const, label: "Putters" },
  { id: "sale" as const, label: "On Sale" },
];

export type TabId = (typeof TABS)[number]["id"];

export function filterByTab(list: Disc[], tab: TabId): Disc[] {
  if (tab === "all") return list;
  if (tab === "sale") return list.filter(isOnSale);
  return list.filter((d) => d.type === tab);
}
