#!/usr/bin/env node
'use strict';

// scripts/build-new-in-stores.js — "Nytt i butikk" feature.
//
// Runs in the daily-scrape GitHub Actions workflow after today's scrape,
// alongside build-price-changes.js. Unlike that script, this one only needs
// TODAY's scraped-prices.json — see scripts/lib/new-in-stores.js's header
// comment for why (firstSeen is already tracked per (discId|store|plastic)
// and never touched once set, so a single snapshot is enough to classify
// what's new).
//
// Writes data/new-in-stores.json: every recent listing classified as
// new-disc / new-release / new-at-store, grouped by ISO week.

const fs = require('fs');
const path = require('path');

const { buildNewInStoresSignals, groupSignalsByWeek } = require('./lib/new-in-stores');
const { discs: SOURCE_DISCS } = require('../data/discs.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRAPED_PRICES_PATH = path.join(REPO_ROOT, 'data', 'scraped-prices.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'data', 'new-in-stores.json');

const CATALOG = SOURCE_DISCS.map(({ id, name, brand, image }) => ({ id, name, brand, image }));

function main() {
  const snapshot = JSON.parse(fs.readFileSync(SCRAPED_PRICES_PATH, 'utf8'));

  // Prefer the snapshot's own lastUpdated over the wall clock so re-running
  // this script against the same data always produces the same output.
  const asOfMs = snapshot.lastUpdated ? new Date(snapshot.lastUpdated).getTime() : Date.now();

  const { signals, quarantinedStores, massResetEvents } = buildNewInStoresSignals({
    snapshot,
    catalog: CATALOG,
    asOfMs,
  });
  const weeks = groupSignalsByWeek(signals);

  const counts = { 'new-disc': 0, 'new-release': 0, 'new-at-store': 0 };
  for (const s of signals) counts[s.type]++;

  const output = {
    generated: new Date().toISOString(),
    summary: {
      totalSignals: signals.length,
      newDiscs: counts['new-disc'],
      newReleases: counts['new-release'],
      newAtStore: counts['new-at-store'],
      weeksIncluded: weeks.length,
      quarantinedStores,
      // Store+date combos where a scraper/matching-logic change reset
      // firstSeen for a suspiciously large batch of listings at once — see
      // MASS_RESET_THRESHOLD's comment in scripts/lib/new-in-stores.js.
      // Logged here (not just console output) so anyone looking at the JSON
      // later can see what got filtered and why, without re-running this.
      suppressedMassResetEvents: massResetEvents,
    },
    weeks,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(
    `new-in-stores.json: ${signals.length} signals (${counts['new-disc']} new-disc, ` +
      `${counts['new-release']} new-release, ${counts['new-at-store']} new-at-store) ` +
      `across ${weeks.length} week(s). Quarantined stores: ${quarantinedStores.join(', ') || 'none'}.`
  );
  if (massResetEvents.length > 0) {
    console.log('Suppressed mass-reset events (scraper/matching churn, not real news):');
    for (const e of massResetEvents) {
      console.log(`  ${e.store} ${e.date}: ${e.count} listings suppressed`);
    }
  }
}

main();
