import {
  discs,
} from "@/data/discs.js";

export type Disc = (typeof discs)[number];

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
