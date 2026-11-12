// lib/price-freshness.ts — how old a scraped price may be and still be shown.
//
// Pure, with no data or path-alias imports, so it is trivially unit-testable
// under plain node — same reason scripts/lib/price-changes.js keeps its
// computation separate from its filesystem access. lib/disc-utils.ts supplies
// the reference timestamp.

// Defense against a store's scraper dying quietly while its last-known prices
// keep being presented as current. Confirmed in production 2026-10-20:
// Discsport had been blocked by its own host since 2026-09-08 (see CLAUDE.md,
// Scraper -> Discsport) and 1387 entries — 42 days old — were still feeding
// "best price", /prisfall and the disc detail table as though scraped that
// morning. The per-store freshness check caught it on day one and emailed
// every day for six weeks; nothing stopped the data being shown.
//
// Seven days, not the freshness check's 36h: that check exists to raise an
// alarm early, this one decides what a visitor is shown, and a store that
// misses one or two runs should not have its whole catalogue vanish over it.
export const MAX_PRICE_AGE_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * Whether a scraped entry is recent enough to show, measured against a
 * reference timestamp (the dataset's own lastUpdated — see disc-utils).
 *
 * Entries with a missing or unparseable lastScraped are KEPT: that field
 * postdates some of the catalogue, and its absence means "unknown", not "old".
 * Dropping on unknown would silently delete real prices.
 */
export function isEntryCurrent(
  entry: { lastScraped?: string },
  referenceMs: number
): boolean {
  if (!entry.lastScraped) return true;
  const scrapedMs = new Date(entry.lastScraped).getTime();
  if (Number.isNaN(scrapedMs)) return true;
  return referenceMs - scrapedMs <= MAX_PRICE_AGE_DAYS * DAY_MS;
}
