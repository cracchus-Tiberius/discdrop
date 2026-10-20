'use strict';

// scripts/check-store-freshness.js — per-store staleness check.
//
// .github/workflows/scrape-freshness-alert.yml already watches the dataset as
// a whole, via scraped-prices.json's lastUpdated. That catches a missed run.
// It cannot catch ONE store quietly dying, because the other eighteen keep the
// dataset looking fresh.
//
// Confirmed in production 2026-09-05: Aceshop had been failing since
// 2026-09-01 — its WAF started 403ing our User-Agent — and its prices sat 94
// hours stale on the live site while every freshness signal stayed green. It
// was found by a routine three-day review, by luck rather than design. Nothing
// in the pipeline said a word.
//
// Exit 1 with ::error:: annotations so a failing step turns the workflow run
// red, which is what triggers GitHub's own failure email. No separate alerting
// infrastructure.
//
// Usage: node scripts/check-store-freshness.js [--max-age-hours=36]

const fs = require('fs');
const path = require('path');

// A store scraped daily is normally under ~24h old at the next run. 36h leaves
// room for a single missed or late run — GitHub's scheduler has run hours late
// before — without waiting so long that a dead store goes unnoticed for days.
const DEFAULT_MAX_AGE_HOURS = 36;

// Stores we know are unreachable, and have decided not to fight. A store in
// here is still reported every run, but as BLOCKED rather than STALE, and it
// does not fail the build.
//
// This exists because an alarm that can never go green stops being an alarm.
// Discsport's host began serving runner IPs a reCAPTCHA page on 2026-09-08
// (CLAUDE.md, Scraper -> Discsport: it is the store declining datacenter
// bots, and we are not building around it). The freshness check did its job
// and failed the run every day for six weeks — by which point a daily red X
// was the normal state of the pipeline, and the next store to die quietly
// would have been just one more line in a log nobody reads any more. That is
// the same inattention this check was written to end.
//
// Listing a store here is only half the answer: it stops the false alarm, it
// does NOT stop the stale prices being shown. lib/price-freshness.ts is what
// keeps them off the site. Add to both, or neither.
const KNOWN_BLOCKED = {
  discsport: {
    since: '2026-09-08',
    reason: 'discsport.se serves datacenter IPs a reCAPTCHA page; see CLAUDE.md (Scraper -> Discsport)',
  },
};

function parseMaxAgeHours(argv) {
  const flag = argv.find((a) => a.startsWith('--max-age-hours='));
  if (!flag) return DEFAULT_MAX_AGE_HOURS;
  const n = Number(flag.slice('--max-age-hours='.length));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --max-age-hours: ${flag}`);
  return n;
}

/**
 * Newest lastScraped per store key, plus every store declared in the snapshot's
 * `stores` block. A store present there but carrying no price entries at all is
 * reported too — that is a scraper returning nothing, which is exactly the
 * failure this exists to catch.
 */
function storeAges(snapshot, nowMs) {
  const newest = new Map();
  for (const entries of Object.values(snapshot.prices || {})) {
    for (const entry of entries) {
      if (!entry.lastScraped) continue;
      const prev = newest.get(entry.store);
      if (prev == null || entry.lastScraped > prev) newest.set(entry.store, entry.lastScraped);
    }
  }

  const rows = [];
  for (const key of Object.keys(snapshot.stores || {})) {
    const last = newest.get(key) || null;
    rows.push({
      store: key,
      lastScraped: last,
      ageHours: last == null ? Infinity : (nowMs - new Date(last).getTime()) / 3_600_000,
      entries: 0,
    });
  }
  for (const entries of Object.values(snapshot.prices || {})) {
    for (const entry of entries) {
      const row = rows.find((r) => r.store === entry.store);
      if (row) row.entries++;
    }
  }
  return rows.sort((a, b) => b.ageHours - a.ageHours);
}

function checkStoreFreshness(
  snapshot,
  { nowMs = Date.now(), maxAgeHours = DEFAULT_MAX_AGE_HOURS, knownBlocked = KNOWN_BLOCKED } = {}
) {
  const rows = storeAges(snapshot, nowMs);
  const stale = rows.filter((r) => r.ageHours > maxAgeHours);
  return {
    rows,
    // `stale` keeps its original meaning: everything past the threshold.
    stale,
    // Expected, already-triaged outages — reported, never fatal.
    blocked: stale.filter((r) => knownBlocked[r.store]),
    // What the check is actually for: a store that went quiet without us
    // knowing why. Only these fail the run.
    unexpected: stale.filter((r) => !knownBlocked[r.store]),
    // A blocked store that started answering again. Worth saying out loud —
    // the entry should come off the list, and off price-freshness's reckoning.
    recovered: rows.filter((r) => knownBlocked[r.store] && r.ageHours <= maxAgeHours),
  };
}

function main() {
  const maxAgeHours = parseMaxAgeHours(process.argv.slice(2));
  const snapshotPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const { rows, blocked, unexpected, recovered } = checkStoreFreshness(snapshot, { maxAgeHours });

  const label = (r) => {
    if (r.ageHours <= maxAgeHours) return '  ok ';
    return KNOWN_BLOCKED[r.store] ? 'BLOCK' : 'STALE';
  };

  console.log(`Per-store freshness (threshold ${maxAgeHours}h), ${rows.length} stores:`);
  for (const r of rows) {
    const age = r.ageHours === Infinity ? 'no priced listings' : `${r.ageHours.toFixed(1)}h`;
    console.log(`  ${label(r)}  ${r.store.padEnd(18)} ${age.padStart(18)}  ${String(r.entries).padStart(5)} entries`);
  }

  for (const r of blocked) {
    const { since, reason } = KNOWN_BLOCKED[r.store];
    console.log(`::warning title=Blocked store: ${r.store}::${r.store} has been unreachable since ${since} (${r.ageHours.toFixed(1)}h stale). ${reason}. Its prices are hidden from the site by lib/price-freshness.ts, so this is expected and does not fail the run.`);
  }

  for (const r of recovered) {
    console.log(`::notice title=Blocked store answering again: ${r.store}::${r.store} is listed as blocked but scraped ${r.ageHours.toFixed(1)}h ago. Remove it from KNOWN_BLOCKED in scripts/check-store-freshness.js.`);
  }

  if (unexpected.length === 0) {
    const suffix = blocked.length ? ` (${blocked.length} known-blocked: ${blocked.map((r) => r.store).join(', ')})` : '';
    console.log(`\nAll ${rows.length - blocked.length} reachable stores scraped within ${maxAgeHours}h${suffix}.`);
    return;
  }

  for (const r of unexpected) {
    const detail = r.ageHours === Infinity
      ? 'has no priced listings at all — its scraper returned nothing'
      : `last scraped ${r.lastScraped} (${r.ageHours.toFixed(1)}h ago, threshold ${maxAgeHours}h)`;
    console.log(`::error title=Stale store: ${r.store}::${r.store} ${detail}. Check that store's step in this run's log.`);
  }
  console.log(`::error::${unexpected.length} of ${rows.length} stores are unexpectedly stale: ${unexpected.map((r) => r.store).join(', ')}`);
  process.exitCode = 1;
}

module.exports = { checkStoreFreshness, storeAges, DEFAULT_MAX_AGE_HOURS, KNOWN_BLOCKED };

if (require.main === module) main();
