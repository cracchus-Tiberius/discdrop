// scripts/scrape-audit.js — audit matched products for suspicious entries
// Reads data/scraped-prices.json + data/unmatched-products.json
// Flags matches where product name contains non-disc keywords or disc name is very short
// Usage: node scripts/scrape-audit.js  or  pnpm scrape:audit
'use strict';

const fs = require('fs');
const path = require('path');

const NON_DISC_KEYWORDS = [
  'bag', 'sekk', 'ryggsekk', 'basket', 'kurv', 'armbånd', 'handledds',
  'towel', 'håndkle', 'marker', 'kasse', 'mold',
];

function containsNonDiscKeyword(name) {
  const lower = name.toLowerCase();
  return NON_DISC_KEYWORDS.filter(kw =>
    new RegExp('(?:^|[\\s,/])' + kw + '(?:[\\s,/]|$)').test(lower)
  );
}

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const dataDir = path.join(__dirname, '..', 'data');
const pricesPath = path.join(dataDir, 'scraped-prices.json');
const unmatchedPath = path.join(dataDir, 'unmatched-products.json');

if (!fs.existsSync(pricesPath)) {
  console.error('data/scraped-prices.json not found — run pnpm scrape first');
  process.exit(1);
}

const pricesData = JSON.parse(fs.readFileSync(pricesPath, 'utf8'));
const unmatchedData = fs.existsSync(unmatchedPath)
  ? JSON.parse(fs.readFileSync(unmatchedPath, 'utf8'))
  : { products: [] };

// Build disc id → name map from prices data (we don't have the full catalog here,
// so we read data/discs.js as text and extract id/name pairs)
const discsPath = path.join(dataDir, 'discs.js');
const discsText = fs.readFileSync(discsPath, 'utf8');
const discMap = {};
for (const m of discsText.matchAll(/id:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]/g)) {
  discMap[m[1]] = m[2];
}

console.log('DiscDrop Scraper Audit');
console.log('='.repeat(60));
console.log(`Discs with prices: ${Object.keys(pricesData.prices).length}`);
console.log('');

// ── 1. Suspicious matched products ───────────────────────────────────────────
// We don't store the original product name after matching — we only have discId + store URL.
// So we check disc names themselves for suspicious patterns, and flag short disc names.

const shortNameMatches = [];
const nonDiscMatches = [];

for (const [discId, entries] of Object.entries(pricesData.prices)) {
  const discName = discMap[discId] || discId;
  const normName = norm(discName);

  // Flag short disc names (< 4 chars) — high false-positive risk
  if (normName.length < 4) {
    shortNameMatches.push({ discId, discName, entries });
  }

  // Flag if the disc name itself contains non-disc keywords (shouldn't happen but sanity check)
  const hits = containsNonDiscKeyword(discName);
  if (hits.length) {
    nonDiscMatches.push({ discId, discName, keywords: hits, entries });
  }
}

if (shortNameMatches.length) {
  console.log(`⚠  Short disc names (< 4 chars) — verify these are real matches:`);
  for (const { discId, discName, entries } of shortNameMatches) {
    console.log(`   ${discId} ("${discName}")`);
    for (const e of entries) {
      console.log(`     store=${e.store}  price=${e.price}  url=${e.url}`);
    }
  }
  console.log('');
}

if (nonDiscMatches.length) {
  console.log(`⚠  Disc names containing non-disc keywords:`);
  for (const { discId, discName, keywords } of nonDiscMatches) {
    console.log(`   ${discId} ("${discName}") — keywords: ${keywords.join(', ')}`);
  }
  console.log('');
}

// ── 2. Unmatched products containing disc-like terms ─────────────────────────
const unmatchedWithDiscTerms = unmatchedData.products.filter(p => {
  const lower = p.rawName.toLowerCase();
  // Heuristic: if it looks like it could be a disc (has a brand-like word or "disc" in name)
  // but wasn't matched — these are worth reviewing
  return /(?:disc|disk|driver|midrange|putter|fairway)/.test(lower);
});

if (unmatchedWithDiscTerms.length) {
  console.log(`ℹ  Unmatched products that look like discs (${unmatchedWithDiscTerms.length} total):`);
  const byStore = {};
  for (const p of unmatchedWithDiscTerms) {
    if (!byStore[p.store]) byStore[p.store] = [];
    byStore[p.store].push(p);
  }
  for (const [store, products] of Object.entries(byStore)) {
    console.log(`   ${store} (${products.length}):`);
    for (const p of products.slice(0, 20)) {
      console.log(`     "${p.rawName}"  kr ${p.price}`);
    }
    if (products.length > 20) console.log(`     … and ${products.length - 20} more`);
  }
  console.log('');
}

// ── 3. Unmatched products containing non-disc keywords ───────────────────────
const unmatchedNonDisc = unmatchedData.products.filter(p => containsNonDiscKeyword(p.rawName).length > 0);
const unmatchedTotal = unmatchedData.products.length;

console.log(`ℹ  Unmatched products total: ${unmatchedTotal}`);
console.log(`   Of which clearly non-disc (keyword match): ${unmatchedNonDisc.length}`);
console.log(`   Potential missing discs: ${unmatchedTotal - unmatchedNonDisc.length}`);
console.log('');

// ── 4. Per-store coverage summary ────────────────────────────────────────────
const storeCounts = {};
for (const entries of Object.values(pricesData.prices)) {
  for (const e of entries) {
    storeCounts[e.store] = (storeCounts[e.store] || 0) + 1;
  }
}

console.log('Store coverage:');
for (const [store, count] of Object.entries(storeCounts).sort((a, b) => b[1] - a[1])) {
  const storeName = pricesData.stores[store]?.name || store;
  console.log(`  ${storeName.padEnd(24)} ${count} discs`);
}
console.log('');

if (shortNameMatches.length === 0 && nonDiscMatches.length === 0) {
  console.log('✓ No suspicious matches found');
}
