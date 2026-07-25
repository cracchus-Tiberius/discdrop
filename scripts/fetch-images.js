'use strict';

// scripts/fetch-images.js — image enrichment from Infinite Discs using Playwright
// Visits the Infinite Discs product page for each disc missing an image and
// saves the first product photo to data/disc-images.json.
// Usage: node scripts/fetch-images.js  or  pnpm fetch-images
//
// Previously built the URL slug by guessing "{brand}-{name}" (capitalized,
// spaces to hyphens) and hoping it resolved. That stopped working — Infinite
// Discs' real slugs are lowercase and don't reliably follow that pattern
// (confirmed via their sitemap: some include the brand, some don't, some use
// a different brand's slug entirely for shared molds). Result was 0/38 found
// on every run. Now fetches their sitemap once per run to get the actual
// slug list and only ever uses a slug we've confirmed exists.

const { chromium } = require('playwright');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const IMAGES_PATH = path.join(__dirname, '..', 'data', 'disc-images.json');
const SCRAPED_PATH = path.join(__dirname, '..', 'data', 'scraped-prices.json');
const SITEMAP_INDEX_URL = 'https://infinitediscs.com/sitemap.xml';

// Path segments that are sitemap noise, not disc-model pages
const NON_PRODUCT_SLUGS = new Set([
  'about-us', 'additional', 'advanced-search', 'contact-us', 'new-releases',
  'newly-added-discs', 'player-profile', 'what-on-sale', 'faqs', 'blog',
]);

// Some brands share molds with a sibling brand under the same manufacturing
// group and Infinite Discs lists the mold under only ONE of the sibling
// slugs — e.g. MVP Fireball is listed as "axiom-fireball". Using that photo
// IS correct (same physical disc), unlike a same-name collision with an
// unrelated brand (e.g. Kastaplast "Neon" vs. the unrelated "Loft Discs
// Neon" — those must NOT be cross-matched). Only cross-check within these
// documented, confirmed-same-factory groups; never search brand-blind.
const SIBLING_BRANDS = {
  MVP: ['Axiom', 'Streamline'],
  Axiom: ['MVP', 'Streamline'],
  Streamline: ['MVP', 'Axiom'],
  'Latitude 64': ['Discmania', 'Westside Discs'],
  Discmania: ['Latitude 64', 'Westside Discs'],
  'Westside Discs': ['Latitude 64', 'Discmania'],
};

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Fetch the real slug list from Infinite Discs' sitemap ─────────────────────

async function fetchRealSlugs() {
  const indexRes = await fetch(SITEMAP_INDEX_URL, { timeout: 15000 });
  if (!indexRes.ok) throw new Error(`sitemap index HTTP ${indexRes.status}`);
  const indexXml = await indexRes.text();
  const subSitemapUrls = [...indexXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  const slugs = new Set();
  for (const sitemapUrl of subSitemapUrls) {
    const res = await fetch(sitemapUrl, { timeout: 30000 });
    if (!res.ok) continue;
    const xml = await res.text();
    for (const m of xml.matchAll(/<loc>https:\/\/infinitediscs\.com\/([a-z0-9-]+)(?:\/[a-z0-9-]+)?<\/loc>/g)) {
      const first = m[1];
      if (!NON_PRODUCT_SLUGS.has(first) && !first.startsWith('page-')) slugs.add(first);
    }
  }
  return slugs;
}

// Find a confirmed-real slug for a disc, trying its own brand first, then
// documented sibling brands only.
function resolveSlug(disc, realSlugs) {
  const nameSlug = slugify(disc.name);
  const brandsToTry = [disc.brand, ...(SIBLING_BRANDS[disc.brand] || [])];
  for (const brand of brandsToTry) {
    const candidate = `${slugify(brand)}-${nameSlug}`;
    if (realSlugs.has(candidate)) return candidate;
  }
  return null;
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
async function fetchDiscImage(page, slug) {
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

  console.log('Fetching real slug list from Infinite Discs sitemap...');
  const realSlugs = await fetchRealSlugs();
  console.log(`Found ${realSlugs.size} real disc-model slugs`);

  const resolved = missing
    .map((d) => ({ disc: d, slug: resolveSlug(d, realSlugs) }))
    .filter((r) => r.slug);
  console.log(`${resolved.length}/${missing.length} discs have a confirmed real slug (rest aren't carried by Infinite Discs, or aren't a documented sibling-brand match — skipped rather than guessed)`);
  console.log('='.repeat(50));

  if (resolved.length === 0) {
    console.log('Nothing resolvable this run.');
    return;
  }

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });
  const page = await context.newPage();

  let found = 0;
  let notFound = 0;

  for (let i = 0; i < resolved.length; i++) {
    const { disc, slug } = resolved[i];
    process.stdout.write(`[${i + 1}/${resolved.length}] ${disc.brand} ${disc.name} (${slug})... `);

    let imgUrl = null;
    try {
      imgUrl = await fetchDiscImage(page, slug);
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

    if (i < resolved.length - 1) {
      await sleep(2000);
    }
  }

  await browser.close();

  console.log('\n' + '='.repeat(50));
  console.log(`Found: ${found}  Not found: ${notFound}  (${resolved.length} attempted, ${missing.length - resolved.length} skipped — no confirmed slug)`);
  console.log(`Saved to ${IMAGES_PATH}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
