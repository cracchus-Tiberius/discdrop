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

function checkStoreFreshness(snapshot, { nowMs = Date.now(), maxAgeHours = DEFAULT_MAX_AGE_HOURS } = {}) {
  const rows = storeAges(snapshot, nowMs);
  return { rows, stale: rows.filter((r) => r.ageHours > maxAgeHours) };
}

function main() {
  const maxAgeHours = parseMaxAgeHours(process.argv.slice(2));
  const snapshotPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const { rows, stale } = checkStoreFreshness(snapshot, { maxAgeHours });

  console.log(`Per-store freshness (threshold ${maxAgeHours}h), ${rows.length} stores:`);
  for (const r of rows) {
    const age = r.ageHours === Infinity ? 'no priced listings' : `${r.ageHours.toFixed(1)}h`;
    console.log(`  ${r.ageHours > maxAgeHours ? 'STALE' : '  ok '}  ${r.store.padEnd(18)} ${age.padStart(18)}  ${String(r.entries).padStart(5)} entries`);
  }

  if (stale.length === 0) {
    console.log(`\nAll ${rows.length} stores scraped within ${maxAgeHours}h.`);
    return;
  }

  for (const r of stale) {
    const detail = r.ageHours === Infinity
      ? 'has no priced listings at all — its scraper returned nothing'
      : `last scraped ${r.lastScraped} (${r.ageHours.toFixed(1)}h ago, threshold ${maxAgeHours}h)`;
    console.log(`::error title=Stale store: ${r.store}::${r.store} ${detail}. Its prices are being shown on the live site as if current. Check that store's step in this run's log.`);
  }
  console.log(`::error::${stale.length} of ${rows.length} stores are stale: ${stale.map((r) => r.store).join(', ')}`);
  process.exitCode = 1;
}

module.exports = { checkStoreFreshness, storeAges, DEFAULT_MAX_AGE_HOURS };

if (require.main === module) main();
