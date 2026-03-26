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

// Maps the display name in discs.js → store key in scraped-prices.json
const STORE_KEY_MAP: Record<string, string> = {
  "We Are Disc Golf": "wearediscgolf",
  "Aceshop": "aceshop",
  "Frisbee Sør": "frisbeesor",
  "GolfDiscer": "golfdiscer",
  "Frisbeebutikken": "frisbeebutikken",
};

/**
 * Returns the stores array for a disc, with real scraped prices merged in.
 * Scraped price/inStock/url take priority over mock data when available.
 */
export function getMergedStores(disc: Disc): Disc["stores"] {
  const scraped = (scrapedPrices.prices as Record<string, ScrapedEntry[]>)[disc.id];
  if (!scraped || scraped.length === 0) return disc.stores;

  const byStoreKey = new Map(scraped.map((e) => [e.store, e]));
  const storeMeta = scrapedPrices.stores as Record<string, StoreMeta>;

  return disc.stores.map((mockStore) => {
    const key = STORE_KEY_MAP[mockStore.name];
    const entry = key ? byStoreKey.get(key) : undefined;
    if (!entry) return mockStore;
    const meta = key ? storeMeta[key] : undefined;
    return {
      ...mockStore,
      price: entry.price,
      inStock: entry.inStock,
      url: entry.url || mockStore.url,
      shipping: meta?.shipping ?? mockStore.shipping,
      freeShippingOver: meta?.freeShippingOver ?? mockStore.freeShippingOver,
    };
  });
}

/** ISO timestamp of last scrape, or null if never scraped */
export const scrapedLastUpdated: string | null = scrapedPrices.lastUpdated as string | null;

export function getBestInStockNOK(disc: Disc): {
  best: number;
  storeCount: number;
  inStockCount: number;
} {
  const inStock = disc.stores.filter((s) => s.inStock);
  const pool = inStock.length ? inStock : disc.stores;
  let best = Infinity;
  for (const s of pool) {
    if (s.price < best) best = s.price;
  }
  if (best === Infinity) best = 0;
  return {
    best,
    storeCount: disc.stores.length,
    inStockCount: inStock.length,
  };
}

export function isOnSale(disc: Disc): boolean {
  const { best } = getBestInStockNOK(disc);
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
  const hasStock = disc.stores.some((x) => x.inStock);
  const tags = disc.tags as string[];
  if (tags.includes("sold-out") || !hasStock) return "Sold Out";
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
