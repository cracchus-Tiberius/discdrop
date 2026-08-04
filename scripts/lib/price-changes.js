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

// A disc's price only counts as a genuine "drop" worth showing if the cut is
// at least this many percentage points — small day-to-day noise (rounding,
// a store nudging a price by a few kroner) shouldn't show up as a "prisfall".
const MIN_DROP_PCT = -5;

// Cap on how many drops from the same brand can appear in one period's list,
// applied greedily after sorting by pct — same pattern as
// buildHotDropRows()/buildLatestDropRows() in app/disc-drop-home.tsx, so one
// brand's blowout sale can't fill the whole grid.
const MAX_PER_BRAND = 2;

/**
 * Landed cost in NOK for one scraped price entry: for non-Norwegian stores,
 * price + shipping (VOEC-registered stores already include MVA in the listed
 * price, but shipping is always due); for Norwegian stores, shipping is
 * conditional on basket total so we don't add it here. Mirrors
 * lib/disc-utils.ts's entryLandedNOK() — keep both in sync if this changes.
 */
function entryLandedNOK(entry, storeMeta) {
  if (storeMeta && storeMeta.country && storeMeta.country !== 'NO') {
    return entry.price + (storeMeta.shipping || 0);
  }
  return entry.price;
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
    if (!entry.price || entry.price < MIN_VALID_PRICE_NOK) continue;
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
 * Round a percentage change per the design spec's convention:
 * Math.round((newPrice / oldPrice - 1) * 100), always negative for a drop.
 */
function pctChange(oldPrice, newPrice) {
  return Math.round((newPrice / oldPrice - 1) * 100);
}

/**
 * Compare two full scraped-prices.json snapshots (`{prices, stores}` shape)
 * for one period (day or week). Returns:
 *   - changedDiscCount: discs whose best landed price differs at all between
 *     old and new (any direction) — this is the ticker's "N prisendringer"
 *     count. A disc is only counted once no matter how many of its stores'
 *     rows changed.
 *   - newDiscCount: discs with a valid price in `newSnapshot` that had none
 *     in `oldSnapshot` (newly in-stock/newly matched).
 *   - dropsRaw: every disc where pct <= MIN_DROP_PCT, sorted by pct ascending
 *     (biggest cut first), BEFORE the per-brand cap — this is what
 *     `totalDrops` should count, since that number promises "all the drops
 *     we found", not just the ones that fit the grid.
 */
function computeChanges({ oldSnapshot, newSnapshot, catalog, period }) {
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
      changedDiscCount++;
      const pct = pctChange(oldBest.landed, newBest.landed);
      if (pct <= MIN_DROP_PCT) {
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

module.exports = {
  MIN_VALID_PRICE_NOK,
  MIN_DROP_PCT,
  MAX_PER_BRAND,
  entryLandedNOK,
  bestLandedEntry,
  pctChange,
  computeChanges,
  capPerBrand,
  buildHistory,
};
