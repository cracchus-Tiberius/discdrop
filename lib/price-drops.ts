// lib/price-drops.ts — shared data-access layer for the Prisfall feature,
// read by both the homepage's PriceDrops section and app/prisfall/page.tsx
// so the two never compute business logic differently.
//
// All numbers here come straight from data/price-changes.json (built daily
// by scripts/build-price-changes.js) — never recomputed from
// scraped-prices.json here. See that script for how oldPrice/newPrice/pct/
// history are derived.
import { discs } from "@/data/discs.js";
import priceChanges from "@/data/price-changes.json";
import { getDiscImage } from "@/lib/disc-utils";

type Disc = (typeof discs)[number];

export type PriceChangePeriod = "day" | "week";

type PriceChangeEntry = {
  discId: string;
  store: string;
  storeName: string;
  plastic: string | null;
  oldPrice: number;
  newPrice: number;
  pct: number;
  changedAt: string | null;
  period: PriceChangePeriod;
  history: number[] | null;
};

type PriceChangesData = {
  generated: string;
  summary: { priceChanges24h: number; newDiscs24h: number; storesChecked: number };
  drops: PriceChangeEntry[];
  totalDrops: number;
  totalDropsWeek: number;
};

export type PriceDropRow = {
  discId: string;
  name: string;
  brand: string;
  type: string;
  image: string;
  plastic: string | null;
  oldPrice: number;
  newPrice: number;
  pct: number;
  storeName: string;
  history: number[];
};

const data = priceChanges as PriceChangesData;
const discById = new Map((discs as Disc[]).map((d) => [d.id, d]));

export const priceChangesGenerated: string = data.generated;
export const priceChangesSummary = data.summary;

// Both the ticker band and the Prisfall section render nothing on a day with
// zero qualifying drops in either window — same "render nothing" pattern as
// LatestDrops. Teasing a feature that currently has nothing behind it (an
// empty grid, a ticker linking to a blank page) is worse than just not
// showing it that day.
export const hasPriceDropsData: boolean = data.drops.length > 0;

export function getTotalDrops(period: PriceChangePeriod): number {
  return period === "day" ? data.totalDrops : data.totalDropsWeek;
}

/** Full sorted (biggest cut first) drop list for one period, joined with catalog data. */
export function getPriceDropRows(period: PriceChangePeriod): PriceDropRow[] {
  const rows: PriceDropRow[] = [];
  for (const entry of data.drops) {
    if (entry.period !== period) continue;
    if (!entry.history || entry.history.length === 0) continue;
    const disc = discById.get(entry.discId);
    if (!disc) continue; // catalog entry removed/renamed since the pipeline ran
    rows.push({
      discId: entry.discId,
      name: disc.name,
      brand: disc.brand,
      type: disc.type,
      image: getDiscImage(disc),
      plastic: entry.plastic,
      oldPrice: entry.oldPrice,
      newPrice: entry.newPrice,
      pct: entry.pct,
      storeName: entry.storeName,
      history: entry.history,
    });
  }
  return rows; // already sorted ascending by pct — see build-price-changes.js
}

// Same greedy max-per-brand pattern as buildHotDropRows()/buildLatestDropRows()
// in app/disc-drop-home.tsx. A display-selection concern for the homepage's
// 6-card grid — the ranked /prisfall list uses the full uncapped rows instead.
export function capPerBrand(rows: PriceDropRow[], max = 2): PriceDropRow[] {
  const counts: Record<string, number> = {};
  const kept: PriceDropRow[] = [];
  for (const row of rows) {
    const count = counts[row.brand] ?? 0;
    if (count >= max) continue;
    counts[row.brand] = count + 1;
    kept.push(row);
  }
  return kept;
}
