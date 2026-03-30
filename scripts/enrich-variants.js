'use strict';
/**
 * enrich-variants.js
 * Post-process scraped-prices.json: extract plastic/edition from URL slugs
 * for entries that have plastic=null/undefined.
 * Run: node scripts/enrich-variants.js
 */
const fs = require('fs');
const path = require('path');
const { DISC_CATALOG } = require('./stores.config.js');
const { parseProductName } = require('./plastic-types.js');

const pricesPath = path.join(__dirname, '../data/scraped-prices.json');
const data = JSON.parse(fs.readFileSync(pricesPath, 'utf8'));

// Build id→brand map
const idToBrand = {};
for (const d of DISC_CATALOG) idToBrand[d.id] = d.brand;

function slugToName(url) {
  // Extract the last path segment and convert slug to space-separated words
  const slug = url.replace(/\/$/, '').split('/').pop() || '';
  return slug.replace(/-/g, ' ');
}

let enriched = 0;
let alreadyHad = 0;
let noMatch = 0;

for (const [discId, entries] of Object.entries(data.prices)) {
  const brand = idToBrand[discId];
  if (!brand) continue;

  for (const entry of entries) {
    if (entry.plastic != null) {
      alreadyHad++;
      continue;
    }
    const nameFromUrl = slugToName(entry.url);
    const { plastic, edition } = parseProductName(nameFromUrl, brand);
    if (plastic) {
      entry.plastic = plastic;
      enriched++;
    } else {
      entry.plastic = null;
      noMatch++;
    }
    if (edition && !entry.edition) {
      entry.edition = edition;
    }
    if (entry.edition === undefined) entry.edition = null;
  }
}

fs.writeFileSync(pricesPath, JSON.stringify(data, null, 2));

console.log(`Enriched: ${enriched} entries got plastic type`);
console.log(`No match: ${noMatch} entries still null`);
console.log(`Already had: ${alreadyHad} entries unchanged`);

// Stats
const allEntries = Object.values(data.prices).flat();
const withPlastic = allEntries.filter(e => e.plastic != null).length;
console.log(`\nTotal entries: ${allEntries.length}`);
console.log(`With plastic: ${withPlastic} (${Math.round(withPlastic/allEntries.length*100)}%)`);

// Show per-brand coverage
const brandCoverage = {};
for (const [discId, entries] of Object.entries(data.prices)) {
  const brand = idToBrand[discId] || 'unknown';
  if (!brandCoverage[brand]) brandCoverage[brand] = { total: 0, withPlastic: 0 };
  for (const e of entries) {
    brandCoverage[brand].total++;
    if (e.plastic) brandCoverage[brand].withPlastic++;
  }
}
console.log('\nCoverage by brand:');
for (const [brand, s] of Object.entries(brandCoverage).sort((a,b) => b[1].total - a[1].total)) {
  const pct = Math.round(s.withPlastic / s.total * 100);
  console.log(`  ${brand}: ${s.withPlastic}/${s.total} (${pct}%)`);
}
