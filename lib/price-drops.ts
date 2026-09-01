// lib/price-drops.ts — shared data-access layer for the Prisfall feature,
// read by both the homepage's PriceDrops section and app/prisfall/page.tsx
// so the two never compute business logic differently.
//
// All numbers here come straight from data/price-changes.json (built daily
// by scripts/build-price-changes.js) — never recomputed from
// scraped-prices.json here. See that script for how oldPrice/newPrice/pct/
// history/bucket are derived — in particular, every row here already
// cleared the trailing-7-day-minimum rule (a genuine new low, not a
// rebound to a price already seen this week) before it ever reached this
// file.
import { discs } from "@/data/discs.js";
import priceChanges from "@/data/price-changes.json";
import { getDiscImage } from "@/lib/disc-utils";

// NOT imported from lib/new-in-stores.ts — that module reads the filesystem
// at load time (safe only in Server Components) and this file is imported
// by the "use client" homepage, which would pull that fs usage into the
// client bundle. Small enough to duplicate locally instead.
const NORWEGIAN_WEEKDAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

type Disc = (typeof discs)[number];

/** Matches scripts/lib/price-changes.js's classifyDropBucket() groups, in display order. */
export type PriceDropBucket = "today" | "yesterday" | "earlier-this-week" | "last-week";

/** Legacy two-way split, kept for the homepage teaser's "I dag / Denne uka" toggle. "day" = the `today` bucket only; "week" = every bucket except `last-week`. */
export type PriceChangePeriod = "day" | "week";

type PriceChangeEntry = {
  discId: string;
  store: string;
  storeName: string;
  plastic: string | null;
  oldPrice: number;
  newPrice: number;
  pct: number;
  date: string;
  bucket: PriceDropBucket;
  history: number[] | null;
};

type PriceChangesData = {
  generated: string;
  summary: { priceChanges24h: number; newDiscs24h: number; storesChecked: number };
  timeline: PriceChangeEntry[];
  totalDrops: number;
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
  date: string;
  bucket: PriceDropBucket;
  history: number[];
};

const data = priceChanges as PriceChangesData;
const discById = new Map((discs as Disc[]).map((d) => [d.id, d]));

export const priceChangesGenerated: string = data.generated;
export const priceChangesSummary = data.summary;

// Both the ticker band and the Prisfall section render nothing on a day with
// zero qualifying drops — teasing a feature that currently has nothing
// behind it is worse than just not showing it that day.
export const hasPriceDropsData: boolean = data.timeline.length > 0;

function toRow(entry: PriceChangeEntry): PriceDropRow | null {
  if (!entry.history || entry.history.length === 0) return null;
  const disc = discById.get(entry.discId);
  if (!disc) return null; // catalog entry removed/renamed since the pipeline ran
  return {
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
    date: entry.date,
    bucket: entry.bucket,
    history: entry.history,
  };
}

const allRows: PriceDropRow[] = data.timeline.map(toRow).filter((r): r is PriceDropRow => r !== null);

function rowsForBuckets(buckets: PriceDropBucket[]): PriceDropRow[] {
  const set = new Set(buckets);
  return allRows.filter((r) => set.has(r.bucket));
}

export function getTotalDrops(period: PriceChangePeriod): number {
  return period === "day" ? rowsForBuckets(["today"]).length : rowsForBuckets(["today", "yesterday", "earlier-this-week"]).length;
}

/** Full sorted (biggest cut first) drop list for the homepage teaser's day/week toggle. */
export function getPriceDropRows(period: PriceChangePeriod): PriceDropRow[] {
  return period === "day" ? rowsForBuckets(["today"]) : rowsForBuckets(["today", "yesterday", "earlier-this-week"]);
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

export type PriceDropGroup = {
  bucket: PriceDropBucket;
  label: string;
  rows: PriceDropRow[];
};

const BUCKET_ORDER: PriceDropBucket[] = ["today", "yesterday", "earlier-this-week", "last-week"];
const BUCKET_LABEL: Record<PriceDropBucket, string> = {
  today: "I dag",
  yesterday: "I går",
  "earlier-this-week": "Tidligere denne uka",
  "last-week": "Forrige uke",
};

/**
 * The full continuous /prisfall list, grouped by bucket in display order,
 * each bucket already sorted biggest-cut-first. A bucket with zero rows is
 * left out entirely — no empty-state placeholder per group.
 */
export function getPriceDropGroups(): PriceDropGroup[] {
  return BUCKET_ORDER.map((bucket) => ({
    bucket,
    label: BUCKET_LABEL[bucket],
    rows: allRows.filter((r) => r.bucket === bucket).sort((a, b) => a.pct - b.pct),
  })).filter((g) => g.rows.length > 0);
}

/** Norwegian weekday name for a "earlier-this-week" row's own date, e.g. "Mandag" — for per-row disambiguation within that group. */
export function dropRowWeekdayLabel(dateStr: string): string {
  const day = NORWEGIAN_WEEKDAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()];
  return day.charAt(0).toUpperCase() + day.slice(1);
}

export type PriceDropWeekStats = {
  count: number;
  biggestPct: number;
  storeCount: number;
};

/** Stats line for the /prisfall hero: "Denne uka: N prisfall · største −X % · M butikker" — the current calendar week's rows (today + yesterday + earlier-this-week), not "last-week". */
export function getWeekStats(): PriceDropWeekStats | null {
  const rows = rowsForBuckets(["today", "yesterday", "earlier-this-week"]);
  if (rows.length === 0) return null;
  return {
    count: rows.length,
    biggestPct: Math.min(...rows.map((r) => r.pct)), // most negative = biggest cut
    storeCount: new Set(rows.map((r) => r.storeName)).size,
  };
}
