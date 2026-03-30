'use strict';

// scripts/fetch-images.js — image enrichment from Infinite Discs using Playwright
// Visits the Infinite Discs product page for each disc missing an image and
// saves the first product photo to data/disc-images.json.
// Usage: node scripts/fetch-images.js  or  pnpm fetch-images

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMAGES_PATH = path.join(__dirname, '..', 'data', 'disc-images.json');
const SCRAPED_PATH = path.join(__dirname, '..', 'data', 'scraped-prices.json');

// Brands whose names must be spelled out in full in the URL slug
// e.g. "Clash Discs" → "Clash-Discs-Salt" not "Clash-Salt"
const FULL_NAME_BRANDS = new Set([
  'Infinite Discs',
  'Lone Star Discs',
  'Thought Space Athletics',
  'Dynamic Discs',
  'Latitude 64',
  'Westside Discs',
  'RPM Discs',
  'Clash Discs',
  'Viking Discs',
  'EggShell Discs',
]);

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Build the Infinite Discs URL slug.
// For most brands: "Innova Destroyer" → "Innova-Destroyer"
// For full-name brands: "Clash Discs Salt" → "Clash-Discs-Salt"
function buildSlug(brand, name) {
  return `${brand} ${name}`.replace(/\s+/g, '-');
}

// ── Determine which discs are missing images ──────────────────────────────────

function getMissingDiscs() {
  // discs.js is ESM — use a dynamic require workaround
  let discs;
  try {
    discs = require('../data/discs.js').discs;
  } catch (_) {
    // If require fails, extract via string parsing
    const raw = fs.readFileSync(path.join(__dirname, '..', 'data', 'discs.js'), 'utf8');
    const match = raw.match(/export\s+const\s+discs\s*=\s*(\[[\s\S]*?\]);?\s*$/m);
    if (!match) throw new Error('Could not parse discs.js');
    discs = eval(match[1]); // eslint-disable-line no-eval
  }

  const discImages = JSON.parse(fs.readFileSync(IMAGES_PATH, 'utf8'));
  const scraped = JSON.parse(fs.readFileSync(SCRAPED_PATH, 'utf8'));

  return discs.filter((d) => {
    if ('image' in d && d.image) return false;        // has image in discs.js
    if (discImages[d.id]) return false;               // already in disc-images.json
    const entries = (scraped.prices || {})[d.id];
    if (entries && entries.some((e) => e.image)) return false; // scraped store has image
    return true;
  }).map((d) => ({ id: d.id, name: d.name, brand: d.brand }));
}

// ── Image extraction ──────────────────────────────────────────────────────────

// Infinite Discs product images live under /Inf_Uploads/DiscProducts/
// Redirecting to /Page/... means there's no standalone disc page — skip it.
async function fetchDiscImage(page, disc) {
  const slug = buildSlug(disc.brand, disc.name);
  const url = `https://infinitediscs.com/${slug}`;

  let resp;
  try {
    resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  } catch (err) {
    return null;
  }

  if (!resp) return null;

  const finalUrl = page.url();

  // Redirected to a brand/listing page — no individual disc page exists
  if (finalUrl.includes('/Page/')) return null;
  if (resp.status() === 404) return null;
  if (resp.status() >= 400) return null;

  // Wait for JS rendering
  await page.waitForTimeout(1200);

  // Grab first real product image
  const src = await page.$eval(
    'img[src*="Inf_Uploads/DiscProducts"]',
    (el) => el.src,
  ).catch(() => null);

  return src || null;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load existing disc-images.json (preserve entries, never overwrite)
  let images = {};
  if (fs.existsSync(IMAGES_PATH)) {
    try {
      images = JSON.parse(fs.readFileSync(IMAGES_PATH, 'utf8'));
    } catch (_) {
      console.warn('Could not parse existing disc-images.json, starting fresh');
    }
  }

  const missing = getMissingDiscs().filter((d) => !images[d.id]);

  console.log(`DiscDrop image enrichment — Infinite Discs (Playwright)`);
  console.log(`${missing.length} discs to fetch`);
  console.log('='.repeat(50));

  if (missing.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  let found = 0;
  let notFound = 0;

  for (let i = 0; i < missing.length; i++) {
    const disc = missing[i];
    process.stdout.write(`[${i + 1}/${missing.length}] ${disc.brand} ${disc.name}... `);

    let imgUrl = null;
    try {
      imgUrl = await fetchDiscImage(page, disc);
    } catch (err) {
      process.stdout.write(`ERROR: ${err.message}\n`);
    }

    if (imgUrl) {
      images[disc.id] = imgUrl;
      found++;
      console.log(`✓  ${imgUrl.split('/').pop()}`);
    } else {
      notFound++;
      console.log(`✗`);
    }

    // Save after each disc so progress survives interruption
    fs.writeFileSync(IMAGES_PATH, JSON.stringify(images, null, 2));

    if (i < missing.length - 1) {
      await sleep(2000);
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log(`Found: ${found}  Not found: ${notFound}  (${missing.length} attempted)`);
  console.log(`Saved to ${IMAGES_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
