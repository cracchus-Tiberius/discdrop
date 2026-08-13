#!/usr/bin/env node
'use strict';

// scripts/audit-price-caps.js — logs every scraped price entry that falls
// outside [MIN_VALID_PRICE_NOK, MAX_VALID_PRICE_NOK] to data/rejected-prices.json.
//
// These bounds are enforced at read time in lib/disc-utils.ts (and mirrored
// in functions/api/bag/generate.js) so a scraper bug — a currency mixup, or
// an accessory/bag/rangefinder whose title happens to contain a generic mold
// name like "Shift" or "Range" — never reaches the site as a real disc
// price. This script doesn't filter anything itself; it just makes the
// otherwise-invisible rejections visible so they can be spot-checked during
// the first week the MAX cap is live, in case a genuinely expensive
// limited-run disc is being wrongly excluded.
//
// Run daily in the pipeline (informational only — never fails the build).
// Usage: node scripts/audit-price-caps.js  or  pnpm audit:price-caps

const fs = require('fs');
const path = require('path');
const { discs: SOURCE_DISCS } = require('../data/discs.js');

// Kept in sync manually with lib/disc-utils.ts / functions/api/bag/generate.js
// — see the comment there for why each bound exists.
const MIN_VALID_PRICE_NOK = 50;
const MAX_VALID_PRICE_NOK = 600;

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRICES_PATH = path.join(DATA_DIR, 'scraped-prices.json');
const OUTPUT_PATH = path.join(DATA_DIR, 'rejected-prices.json');

const discNameById = new Map(SOURCE_DISCS.map((d) => [d.id, `${d.brand} ${d.name}`]));

function main() {
  const data = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf8'));
  const rejected = [];

  for (const [discId, entries] of Object.entries(data.prices)) {
    for (const e of entries) {
      if (e.price >= MIN_VALID_PRICE_NOK && e.price <= MAX_VALID_PRICE_NOK) continue;
      rejected.push({
        discId,
        discName: discNameById.get(discId) || discId,
        store: e.store,
        price: e.price,
        reason: e.price < MIN_VALID_PRICE_NOK ? 'below-min' : 'above-max',
        url: e.url,
        lastScraped: e.lastScraped,
      });
    }
  }

  rejected.sort((a, b) => b.price - a.price);

  const output = {
    generated: new Date().toISOString(),
    bounds: { min: MIN_VALID_PRICE_NOK, max: MAX_VALID_PRICE_NOK },
    count: rejected.length,
    rejected,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`rejected-prices.json: ${rejected.length} entries outside [${MIN_VALID_PRICE_NOK}, ${MAX_VALID_PRICE_NOK}] kr`);
}

main();
