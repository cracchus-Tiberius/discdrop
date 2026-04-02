'use strict';

// scripts/fetch-images-westsidediscs.js — fetch disc images from westsidediscs.com
// Strategy: Shopify /products.json API — no Playwright needed
// Matches product titles to Westside Discs in our catalogue by disc name
// Only fills in entries that are currently missing an image
// Usage: node scripts/fetch-images-westsidediscs.js  or  pnpm fetch-images:westside

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const IMAGES_PATH = path.join(__dirname, '..', 'data', 'disc-images.json');
const DISCS_PATH  = path.join(__dirname, '..', 'data', 'discs.js');

const BASE_URL = 'https://westsidediscs.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

// ── Load disc catalogue ───────────────────────────────────────────────────────

function loadWestsideDiscs() {
  const raw = fs.readFileSync(DISCS_PATH, 'utf8');
  // Parse entries for Westside Discs using line-by-line extraction
  const results = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line.includes('brand:"Westside Discs"') && !line.includes('brand: "Westside Discs"')) continue;
    const idMatch = line.match(/id:\s*"([^"]+)"/);
    const nameMatch = line.match(/name:\s*"([^"]+)"/);
    if (idMatch && nameMatch) {
      results.push({ id: idMatch[1], name: nameMatch[1] });
    }
  }
  return results;
}

// ── Match product title to a disc ─────────────────────────────────────────────
// Product titles look like "VIP Harp", "Tournament Bear", "DyeMax Sword"
// We strip plastic/variant words and check for the disc name.

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchTitle(title, discs) {
  const norm = normalize(title);
  // Sort discs by name length descending — prefer longer matches (Swan 2 > Swan)
  const sorted = [...discs].sort((a, b) => b.name.length - a.name.length);

  for (const disc of sorted) {
    const discNorm = normalize(disc.name);
    // Build a pattern that matches the disc name as whole words
    const escaped = discNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
    if (re.test(norm)) return disc;
  }
  return null;
}

// ── Fetch all products from Shopify API ───────────────────────────────────────

async function fetchAllProducts() {
  const products = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/products.json?limit=250&page=${page}`;
    process.stdout.write(`  Fetching page ${page}...`);

    let data;
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.log(` failed: ${err.message}`);
      break;
    }

    const batch = data.products || [];
    if (batch.length === 0) { console.log(' done'); break; }

    for (const p of batch) {
      const image = p.images?.[0]?.src || null;
      if (p.title && image) {
        products.push({ title: p.title, image });
      }
    }

    console.log(` ${batch.length} products (total: ${products.length})`);
    await new Promise(r => setTimeout(r, 800));
    page++;
  }

  return products;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('DiscDrop image enrichment — Westside Discs (Shopify API)');
  console.log('='.repeat(50));

  const discs = loadWestsideDiscs();
  console.log(`Catalogue: ${discs.length} Westside Discs`);

  const images = fs.existsSync(IMAGES_PATH)
    ? JSON.parse(fs.readFileSync(IMAGES_PATH, 'utf8'))
    : {};

  // Only target discs without an image
  const needsImage = discs.filter(d => !images[d.id]);
  console.log(`Missing images: ${needsImage.length}`);

  if (needsImage.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  console.log('');
  const products = await fetchAllProducts();
  console.log(`\nFetched ${products.length} products from westsidediscs.com\n`);
  console.log('='.repeat(50));

  let found = 0;
  let notFound = 0;

  for (const disc of needsImage) {
    process.stdout.write(`${disc.id}... `);

    // Find the best matching product title
    // Try each product and pick the one whose title matches
    let match = null;
    for (const p of products) {
      if (matchTitle(p.title, [disc])) {
        match = p;
        break;
      }
    }

    if (match) {
      images[disc.id] = match.image;
      found++;
      console.log(`✓  ${match.title}`);
    } else {
      notFound++;
      console.log(`✗`);
    }
  }

  fs.writeFileSync(IMAGES_PATH, JSON.stringify(images, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log(`Found: ${found}  Not found: ${notFound}  (${needsImage.length} attempted)`);
  console.log(`Saved to ${IMAGES_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
