#!/usr/bin/env node
// Audits meta title + description lengths for every /disc/[slug] page.
// Exits 1 if any page exceeds the hard max — wired into pnpm build to prevent
// shipping broken meta tags. Also runnable standalone via pnpm check-meta-lengths.

import { discs } from "../data/discs.js";
import scraped from "../data/scraped-prices.json" with { type: "json" };
import { buildDiscMeta, TITLE_HARD_MAX, DESCRIPTION_HARD_MAX } from "../lib/disc-meta.mjs";

// Mirrors lib/disc-utils.ts:getScrapedPrice — keep in sync.
function entryLanded(entry, meta) {
  if (meta?.country && meta.country !== "NO") return entry.price + (meta.shipping ?? 0);
  return entry.price;
}
function getPriceInfo(discId) {
  const list = scraped.prices[discId];
  if (!list || list.length === 0) return { price: null, inStockCount: 0 };
  const inStock = list.filter((s) => s.inStock);
  return {
    price: inStock.length ? Math.min(...inStock.map((s) => entryLanded(s, scraped.stores[s.store]))) : null,
    inStockCount: new Set(inStock.map((s) => s.store)).size,
  };
}

const results = discs.map((d) => {
  const info = getPriceInfo(d.id);
  const meta = buildDiscMeta(d, info);
  return { id: d.id, title: meta.title, description: meta.description, hasPrice: meta.hasPrice };
});

const TITLE_BUCKETS = [
  { label: "≤55 chars   ", test: (n) => n <= 55 },
  { label: "56-60 chars ", test: (n) => n >= 56 && n <= 60 },
  { label: "61-65 chars ", test: (n) => n >= 61 && n <= 65 },
  { label: ">65 chars  ⚠️", test: (n) => n > 65 },
];
const DESC_BUCKETS = [
  { label: "≤140 chars  ", test: (n) => n <= 140 },
  { label: "141-155     ", test: (n) => n >= 141 && n <= 155 },
  { label: "156-160     ", test: (n) => n >= 156 && n <= 160 },
  { label: ">160      ⚠️", test: (n) => n > 160 },
];

const titleCounts = TITLE_BUCKETS.map((b) => results.filter((r) => b.test(r.title.length)).length);
const descCounts = DESC_BUCKETS.map((b) => results.filter((r) => b.test(r.description.length)).length);
const titleOver = results.filter((r) => r.title.length > TITLE_HARD_MAX);
const descOver = results.filter((r) => r.description.length > DESCRIPTION_HARD_MAX);
const total = results.length;
const withPrice = results.filter((r) => r.hasPrice).length;
const avgTitle = (results.reduce((s, r) => s + r.title.length, 0) / total).toFixed(1);
const avgDesc = (results.reduce((s, r) => s + r.description.length, 0) / total).toFixed(1);

console.log("");
console.log("Meta tag length audit — /disc/[slug]");
console.log("=".repeat(50));
console.log(`Total disc pages:        ${total}`);
console.log(`With-price template:     ${withPrice}`);
console.log(`Without-price template:  ${total - withPrice}`);
console.log(`Avg title length:        ${avgTitle}`);
console.log(`Avg description length:  ${avgDesc}`);
console.log("");
console.log("Title length distribution (target ≤60, hard max 65):");
TITLE_BUCKETS.forEach((b, i) => console.log(`  ${b.label}  ${String(titleCounts[i]).padStart(4)} pages`));
if (titleOver.length) {
  console.log("");
  console.log("Pages exceeding 65 chars:");
  for (const r of titleOver) console.log(`  - ${r.id} (${r.title.length} chars): "${r.title}"`);
}
console.log("");
console.log("Description length distribution (target ≤155, hard max 160):");
DESC_BUCKETS.forEach((b, i) => console.log(`  ${b.label}  ${String(descCounts[i]).padStart(4)} pages`));
if (descOver.length) {
  console.log("");
  console.log("Pages exceeding 160 chars:");
  for (const r of descOver) console.log(`  - ${r.id} (${r.description.length} chars): "${r.description}"`);
}
console.log("");

if (titleOver.length || descOver.length) {
  console.error(`✗ ${titleOver.length} title(s) + ${descOver.length} description(s) exceed hard max — failing build`);
  process.exit(1);
}
console.log("✓ All meta tags within hard max");
