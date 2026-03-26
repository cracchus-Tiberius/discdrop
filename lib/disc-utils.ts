import {
  discs,
} from "@/data/discs.js";
import scrapedPrices from "@/data/scraped-prices.json";

export type Disc = (typeof discs)[number];

type ScrapedEntry = {
  store: string;
  price: number;
  inStock: boolean;
  url: string;
  lastScraped: string;
};

type StoreMeta = {
  name: string;
  url: string;
  freeShippingOver: number;
  shipping: number;
};

/**
 * Returns price/stock data from scraped-prices.json for a disc ID.
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
  const inStock = scraped.filter((s) => s.inStock);
  return {
    price: inStock.length ? Math.min(...inStock.map((s) => s.price)) : null,
    inStockCount: inStock.length,
    storeCount: scraped.length,
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

  const storeMeta = scrapedPrices.stores as Record<string, StoreMeta>;

  return scraped.map((entry) => {
    const meta = storeMeta[entry.store];
    return {
      name: meta?.name ?? entry.store,
      url: entry.url,
      price: entry.price,
      inStock: entry.inStock,
      shipping: meta?.shipping ?? 99,
      freeShippingOver: meta?.freeShippingOver ?? 999,
    };
  });
}

/** ISO timestamp of last scrape, or null if never scraped */
export const scrapedLastUpdated: string | null = scrapedPrices.lastUpdated as string | null;

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

export function releaseBadge(
  disc: Disc
): "New Drop" | "Hot" | "Limited" | "Sold Out" {
  const { inStockCount } = getScrapedPrice(disc.id);
  const tags = disc.tags as string[];
  if (tags.includes("sold-out") || inStockCount === 0) return "Sold Out";
  if (tags.includes("limited")) return "Limited";
  if (tags.includes("hot")) return "Hot";
  if (tags.includes("new")) return "New Drop";
  return "Hot";
}

export function badgeStyles(
  kind: "New Drop" | "Hot" | "Limited" | "Sold Out"
): string {
  switch (kind) {
    case "Sold Out":
      return "bg-white/10 text-muted";
    case "Limited":
      return "bg-alert/20 text-alert";
    case "Hot":
      return "bg-accent/15 text-accent";
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
