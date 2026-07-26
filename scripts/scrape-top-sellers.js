// scripts/scrape-top-sellers.js — refreshes data/top-sellers.json from
// Infinite Discs' "top selling discs last month" page, a rolling ranking
// that reflects actual US sales over the trailing 30 days (not a one-time
// blog post — the ranking changes month to month).
//
// Ranked names are matched to our catalog via the shared matcher, then
// filtered to discs actually carried by at least one of our tracked stores
// (data/scraped-prices.json) — no point promoting a disc our users can't
// buy through DiscDrop. Order on the page IS the popularity order, so the
// output array is written in that order (the homepage just takes the first
// N with a catalogId, unsorted).
//
// Run every ~14 days via .github/workflows/refresh-top-sellers.yml.
// Usage: node scripts/scrape-top-sellers.js  or  pnpm scrape:top-sellers
'use strict';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { matchDisc, DISC_CATALOG } = require('./stores.config.js');

const SOURCE_URL = 'https://infinitediscs.com/top-selling/discs-last-month';
const OUT_PATH = path.join(__dirname, '../data/top-sellers.json');
const PRICES_PATH = path.join(__dirname, '../data/scraped-prices.json');

// Infinite Discs is a US retailer — its ranking reflects the US market and
// won't surface Scandinavian-market favorites like Kastaplast's Berg, which
// rarely cracks US top-seller lists despite being (anecdotally) the most
// popular disc in Norway/Sweden. Pin local favorites ahead of the live feed
// rather than let a US-sourced ranking silently erase them.
const PINNED_CATALOG_IDS = ['kastaplast-berg'];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en;q=0.9',
};

async function fetchRanked() {
  const res = await fetch(SOURCE_URL, { headers: HEADERS, timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${SOURCE_URL}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const ranked = [];
  $('.numbering').each((_, el) => {
    const row = $(el).parent();
    const rank = parseInt($(el).text().trim(), 10);
    const name = row.find('h1').first().text().trim();
    const href = row.find('.gallary a').first().attr('href') || '';
    if (!rank || !name) return;
    ranked.push({ rank, name, href });
  });

  ranked.sort((a, b) => a.rank - b.rank);
  return ranked;
}

function storesCarrying(catalogId, prices) {
  return (prices[catalogId] || []).length;
}

function main() {
  return fetchRanked().then((ranked) => {
    if (ranked.length === 0) {
      console.error('No ranked discs parsed — page structure may have changed');
      process.exit(1);
    }
    console.log(`Parsed ${ranked.length} ranked discs from ${SOURCE_URL}`);

    const priceData = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf8'));
    const prices = priceData.prices || {};

    const discs = [];
    const seenIds = new Set();
    let skippedNoMatch = 0;
    let skippedNoCoverage = 0;

    for (const catalogId of PINNED_CATALOG_IDS) {
      const disc = DISC_CATALOG.find((d) => d.id === catalogId);
      if (!disc) {
        console.warn(`  Pinned catalogId "${catalogId}" not found in catalog — skipping`);
        continue;
      }
      seenIds.add(catalogId);
      discs.push({ name: disc.name, brand: disc.brand, score: ranked.length + 10, catalogId, note: 'Pinned: Scandinavian-market favorite' });
    }

    for (const { rank, name, href } of ranked) {
      const hrefWords = href.split(/[/-]/).filter(Boolean).join(' ');
      const match = matchDisc(name) || matchDisc(`${name} ${hrefWords}`);

      if (!match) {
        skippedNoMatch++;
        continue;
      }
      if (seenIds.has(match.id)) continue; // already pinned
      const coverage = storesCarrying(match.id, prices);
      if (coverage === 0) {
        skippedNoCoverage++;
        continue;
      }

      seenIds.add(match.id);
      discs.push({
        name: match.name,
        brand: match.brand,
        score: Math.max(1, ranked.length - rank + 1),
        catalogId: match.id,
      });
    }

    console.log(`Matched ${discs.length} discs with store coverage (${skippedNoMatch} no catalog match, ${skippedNoCoverage} no store coverage)`);

    if (discs.length === 0) {
      console.error('No discs survived matching + coverage filtering — refusing to overwrite top-sellers.json');
      process.exit(1);
    }

    const out = {
      generated: new Date().toISOString().slice(0, 10),
      sources: [SOURCE_URL],
      discs,
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n');
    console.log(`Wrote ${discs.length} discs to ${path.relative(process.cwd(), OUT_PATH)}`);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
