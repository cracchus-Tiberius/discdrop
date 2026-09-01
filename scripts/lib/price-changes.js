'use strict';

// scripts/lib/price-changes.js — pure computation functions for the Prisfall
// feature's daily diff. No filesystem/git access here on purpose (that lives
// in scripts/build-price-changes.js) so this module is trivially unit-testable.
//
// Design spec: Claude Design project "DiscDrop Redesign",
// design_handoff_prisfall/README.md (2026-08-04).

// Same floor as lib/disc-utils.ts's MIN_VALID_PRICE_NOK — defense against
// scraper currency bugs (e.g. the Discexpress USD-as-SEK incident). Kept in
// sync manually since this file runs under plain Node, not the Next.js
// TS pipeature; if that floor ever changes, change both.
const MIN_VALID_PRICE_NOK = 50;

// Same ceiling as lib/disc-utils.ts's MAX_VALID_PRICE_NOK / audit-price-
// caps.js — without it, a garbage price sitting in an OLD git snapshot
// (e.g. the pre-fix Discsport regex bug that once produced 64275 kr for
// Latitude 64 Bite) can still get picked as that disc's "best" price for
// that historical day if it was the only entry in stock, producing a fake
// ~-100% week-over-week "prisfall" long after the live data was fixed —
// confirmed in production 2026-08-16, caught by the daily Prisfall
// product-match routine. The live site itself was never wrong; only this
// script's read of old history was.
const MAX_VALID_PRICE_NOK = 600;

// A disc's price only counts as a genuine "drop" worth showing if the cut is
// at least this many percentage points — small day-to-day noise (rounding,
// a store nudging a price by a few kroner) shouldn't show up as a "prisfall".
const MIN_DROP_PCT = -5;

// Below these thresholds a price move doesn't even count as a "change" at
// all (not just "not a drop") — a live run found 201 "prisfall" that were
// almost entirely SEK/EUR->NOK exchange-rate drift on international stores'
// listed prices (fetched fresh every scrape), not real price cuts. A change
// must clear BOTH bounds — percentage alone falsely flags cheap discs where
// a single-krone rounding wobble is already >2%, and kr alone falsely flags
// expensive discs where 2% is a large absolute number but still just noise.
const NOISE_MIN_ABS_PCT = 2;
const NOISE_MIN_ABS_NOK = 5;

// Cap on how many drops from the same brand can appear in one period's list,
// applied greedily after sorting by pct — same pattern as
// buildHotDropRows()/buildLatestDropRows() in app/disc-drop-home.tsx, so one
// brand's blowout sale can't fill the whole grid.
const MAX_PER_BRAND = 2;

/**
 * Landed cost in NOK: disc price, plus shipping unless the store's
 * freeShippingOver threshold is met by the price alone. International stores
 * never define freeShippingOver (see scripts/stores.config.js's
 * STORE_CONFIGS), so they always get shipping added. Mirrors
 * lib/disc-utils.ts's entryLandedNOK() — keep both in sync if this changes.
 */
function entryLandedNOK(entry, storeMeta) {
  if (!storeMeta) return entry.price;
  if (storeMeta.freeShippingOver != null && entry.price >= storeMeta.freeShippingOver) {
    return entry.price;
  }
  return entry.price + (storeMeta.shipping || 0);
}

/**
 * Given the raw entries array for one disc (as stored in
 * scraped-prices.json's `prices[discId]`) and the file's `stores` metadata
 * object, return the cheapest valid in-stock landed offer, or null if the
 * disc has no valid in-stock price anywhere.
 */
function bestLandedEntry(entries, storesMeta) {
  if (!entries || entries.length === 0) return null;
  let best = null;
  for (const entry of entries) {
    if (!entry.inStock) continue;
    if (!entry.price || entry.price < MIN_VALID_PRICE_NOK || entry.price > MAX_VALID_PRICE_NOK) continue;
    const meta = storesMeta[entry.store];
    const landed = entryLandedNOK(entry, meta);
    if (!best || landed < best.landed) {
      best = {
        landed,
        store: entry.store,
        storeName: (meta && meta.name) || entry.store,
        plastic: entry.plastic || null,
        url: entry.url,
        lastScraped: entry.lastScraped || null,
      };
    }
  }
  return best;
}

/**
 * Lowest landed price for a disc across a set of snapshots, or null if the
 * disc has no valid in-stock price in any of them. Snapshot order doesn't
 * matter here — every snapshot is checked.
 */
function trailingMinLanded(discId, snapshots) {
  let min = null;
  for (const snap of snapshots) {
    const best = bestLandedEntry((snap && snap.prices || {})[discId], (snap && snap.stores) || {});
    if (best && (min == null || best.landed < min)) min = best.landed;
  }
  return min;
}

/**
 * Round a percentage change per the design spec's convention:
 * Math.round((newPrice / oldPrice - 1) * 100), always negative for a drop.
 */
function pctChange(oldPrice, newPrice) {
  return Math.round((newPrice / oldPrice - 1) * 100);
}

/**
 * Compare two full scraped-prices.json snapshots (`{prices, stores}` shape)
 * for one period (day or week). Returns:
 *   - changedDiscCount: discs whose best landed price differs by more than
 *     the noise thresholds (NOISE_MIN_ABS_PCT and NOISE_MIN_ABS_NOK, both
 *     required) between old and new (any direction) — this is the ticker's
 *     "N prisendringer" count. A disc is only counted once no matter how
 *     many of its stores' rows changed. A difference that doesn't clear
 *     both thresholds isn't counted as a change at all.
 *   - newDiscCount: discs with a valid price in `newSnapshot` that had none
 *     in `oldSnapshot` (newly in-stock/newly matched).
 *   - dropsRaw: every disc where pct <= MIN_DROP_PCT, sorted by pct ascending
 *     (biggest cut first), BEFORE the per-brand cap — this is what
 *     `totalDrops` should count, since that number promises "all the drops
 *     we found", not just the ones that fit the grid.
 *
 * `trailingSnapshots`, if given, gates dropsRaw further: a disc only
 * qualifies as a genuine drop if newBest.landed is strictly BELOW the
 * lowest price seen across every snapshot in trailingSnapshots — not just
 * below oldSnapshot. Confirmed in production: a disc whose price went
 * 284 -> 305 -> 284 (a temporary bump, then a return to the same price)
 * showed as a fake "-7%" prisfall comparing only yesterday(305) to
 * today(284), even though 284 was already that disc's price 2 days
 * earlier — not a new low, just noise reverting. Doesn't affect
 * changedDiscCount (that's still "did the price move at all", not "is
 * this a new low") — only whether the disc makes it into dropsRaw.
 */
function computeChanges({ oldSnapshot, newSnapshot, catalog, period, trailingSnapshots }) {
  const oldPrices = (oldSnapshot && oldSnapshot.prices) || {};
  const newPrices = (newSnapshot && newSnapshot.prices) || {};
  const storesMeta = (newSnapshot && newSnapshot.stores) || {};
  const catalogById = new Map(catalog.map((d) => [d.id, d]));

  let changedDiscCount = 0;
  let newDiscCount = 0;
  const dropsRaw = [];

  const allDiscIds = new Set([...Object.keys(oldPrices), ...Object.keys(newPrices)]);

  for (const discId of allDiscIds) {
    const disc = catalogById.get(discId);
    if (!disc) continue; // catalog entry removed/renamed since this snapshot — skip, not our concern here

    const oldBest = bestLandedEntry(oldPrices[discId], storesMeta);
    const newBest = bestLandedEntry(newPrices[discId], storesMeta);

    if (!oldBest && newBest) {
      newDiscCount++;
      continue; // a brand-new price isn't a "change" from a prior price — no pct to compute
    }
    if (!newBest) continue; // no longer available anywhere — not shown as a drop

    if (oldBest.landed !== newBest.landed) {
      const pct = pctChange(oldBest.landed, newBest.landed);
      const absNok = Math.abs(newBest.landed - oldBest.landed);
      const isNoise = Math.abs(pct) < NOISE_MIN_ABS_PCT || absNok < NOISE_MIN_ABS_NOK;
      if (isNoise) continue; // exchange-rate/rounding wobble, not a real change

      changedDiscCount++;
      if (pct <= MIN_DROP_PCT) {
        if (trailingSnapshots) {
          const trailingMin = trailingMinLanded(discId, trailingSnapshots);
          if (trailingMin != null && newBest.landed >= trailingMin) continue; // not a new low — a rebound, not news
        }
        dropsRaw.push({
          discId,
          brand: disc.brand,
          store: newBest.store,
          storeName: newBest.storeName,
          plastic: newBest.plastic,
          oldPrice: oldBest.landed,
          newPrice: newBest.landed,
          pct,
          changedAt: newBest.lastScraped || (newSnapshot && newSnapshot.generated) || null,
          period,
          // Not shown in the UI — kept for the daily anomaly-review routine,
          // which has no way to fetch the store page itself and uses the
          // URL slug as its main clue for "does this look like the same
          // product as the catalog disc" (see README/CLAUDE.md).
          url: newBest.url,
        });
      }
    }
  }

  dropsRaw.sort((a, b) => a.pct - b.pct); // most negative (biggest cut) first
  return { changedDiscCount, newDiscCount, dropsRaw };
}

/**
 * Greedy per-brand cap, applied to an already-sorted (biggest cut first)
 * drops array. Keeps input order among kept items.
 */
function capPerBrand(sortedDrops, max = MAX_PER_BRAND) {
  const perBrandCount = new Map();
  const kept = [];
  for (const drop of sortedDrops) {
    const count = perBrandCount.get(drop.brand) || 0;
    if (count >= max) continue;
    perBrandCount.set(drop.brand, count + 1);
    kept.push(drop);
  }
  return kept;
}

/**
 * Build a chronological (oldest -> newest) price-history array for one disc
 * across a list of snapshots. `snapshots` must already be ordered oldest to
 * newest. Missing/out-of-stock points fall back to the nearest earlier known
 * price so the sparkline never has a gap; if the disc has no price in ANY
 * snapshot, returns null (caller should skip charting it).
 * Always returns exactly `targetLength` points — if fewer snapshots were
 * available (early days of the pipeline running), the earliest known price
 * is repeated at the front so the chart still renders sensibly instead of
 * looking like a crash.
 */
function buildHistory(discId, snapshots, targetLength = 7) {
  const points = [];
  let lastKnown = null;
  for (const snap of snapshots) {
    const best = bestLandedEntry((snap.prices || {})[discId], snap.stores || {});
    if (best) lastKnown = best.landed;
    points.push(lastKnown); // still null if we haven't seen a price yet
  }
  // Backfill any leading nulls (disc had no price in the earliest snapshots)
  // with the first real value we do have, so the array has no gaps.
  const firstReal = points.find((p) => p != null);
  if (firstReal == null) return null; // never priced in this whole window
  for (let i = 0; i < points.length; i++) {
    if (points[i] == null) points[i] = firstReal;
  }
  while (points.length < targetLength) points.unshift(points[0]);
  return points.slice(-targetLength);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Classifies a drop's calendar date ("YYYY-MM-DD") relative to today into
 * one of the /prisfall page's four groups. `mondayOfThisWeekMs` is the
 * epoch ms of 00:00 UTC on the Monday starting today's ISO week (see
 * scripts/lib/new-in-stores.js's getIsoWeekStart, same convention).
 */
function classifyDropBucket(dateStr, todayStr, mondayOfThisWeekMs) {
  if (dateStr === todayStr) return 'today';
  const dateMs = new Date(`${dateStr}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  if (dateMs === todayMs - DAY_MS) return 'yesterday';
  if (dateMs >= mondayOfThisWeekMs) return 'earlier-this-week';
  return 'last-week';
}

module.exports = {
  MIN_VALID_PRICE_NOK,
  MAX_VALID_PRICE_NOK,
  MIN_DROP_PCT,
  MAX_PER_BRAND,
  NOISE_MIN_ABS_PCT,
  NOISE_MIN_ABS_NOK,
  entryLandedNOK,
  bestLandedEntry,
  trailingMinLanded,
  pctChange,
  computeChanges,
  capPerBrand,
  buildHistory,
  classifyDropBucket,
};
