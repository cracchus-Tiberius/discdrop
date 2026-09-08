// scripts/scrape-discsport.js — scraper for discsport.se (custom platform)
// Platform: custom Angular/server-rendered — requires Playwright
// Currency: SEK → converted to NOK with live rate (~1:1)
// Shipping to Norway: 39 SEK ≈ 40 NOK — VOEC registered (MVA inkl.)
// Usage: node scripts/scrape-discsport.js  or  pnpm scrape:discsport
'use strict';

const fetch = require('node-fetch');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');
const { fetchSekToNok, fxMeta } = require('./lib/fx.js');

const STORE = {
  key: 'discsport',
  name: 'Discsport',
  baseUrl: 'https://discsport.se',
  shipping: 40, // 39 SEK ≈ 40 NOK
  country: 'SE',
  voec: true,
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── SEK → NOK rate ────────────────────────────────────────────────────────────


// ── Helpers ───────────────────────────────────────────────────────────────────

// Parse "229:-", "149:-", "1 299:-" → integer SEK
function parseSekPrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, '').replace(':-', '').replace(/[^0-9]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// Swedish disc type keywords to find where name ends
const TYPE_KEYWORDS = ['Distance Driver', 'Fairway Driver', 'Midrange', 'Putt', 'Approach'];
// Labels that appear before the product name
const SKIP_LABELS = ['Slutsåld', 'Bästsäljare', 'Nyhet', 'Kampanj', 'Rea', 'Ny'];

function extractNameFromColText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameLines = [];
  let pastLabels = false;

  for (const line of lines) {
    // Skip pure numbers (rankings like "14")
    if (/^\d+$/.test(line)) continue;
    // Skip price lines
    if (/^\d[\d\s]*:-$/.test(line)) break;
    // Skip known labels before name
    if (!pastLabels && SKIP_LABELS.some(l => line.startsWith(l))) continue;
    // Stop at disc type
    if (TYPE_KEYWORDS.some(kw => line.startsWith(kw))) break;
    // Stop at single-letter stock codes ("A", "B", "N")
    if (/^[A-Z]$/.test(line) && pastLabels) break;

    pastLabels = true;
    nameLines.push(line);
  }

  return nameLines.join(' ').trim();
}

// ── Scraper ───────────────────────────────────────────────────────────────────

async function scrape() {
  let playwright, browser;
  try {
    playwright = require('playwright');
  } catch {
    console.error('Playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'sv-SE',
    extraHTTPHeaders: { 'Accept-Language': 'sv;q=0.9,en;q=0.7' },
  });

  try {
    // ── Step 1: Extract mold slugs from autocomplete on the main disc page ──────
    console.log('  Loading disc catalogue page to extract mold slugs...');

    // Format: " Destroyer##15##2##discar/mold/destroyer "
    //
    // Read from the HTML the server sends, NOT through the browser. The
    // payload sits in inline <script> tags of the server-rendered page, and
    // discsport.se is an Angular app: once it bootstraps it replaces that
    // markup, so page.evaluate() only sees the slugs if it wins a race
    // against hydration. On a laptop it wins; on a GitHub runner it loses,
    // every time and in every retry.
    //
    // That is the 2026-08-18 incident ("0 slugs on the GA run, 997 live
    // minutes later, no code or site change"), and it repeated on
    // 2026-09-07, taking Discsport out for three days until the staleness
    // check caught it. Retrying never had a chance: all three attempts lose
    // the same race the same way. Verified 2026-09-08 that a plain fetch
    // returns all 1014 slugs, with any user agent or none — the browser was
    // never needed for this step, and skipping it also drops ~16s off the
    // run.
    async function extractMoldSlugs() {
      const res = await fetch(`${STORE.baseUrl}/discar`, {
        headers: { 'User-Agent': UA },
        timeout: 30000,
        redirect: 'follow', // /discar 301s to /discar/alla
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} loading the catalogue page`);
      const html = await res.text();
      const slugs = new Set();
      for (const m of html.matchAll(/"[^"]*##\d+##2##discar\/mold\/([^"\s]+)[^"]*"/g)) {
        const moldSlug = m[1];
        // Discsport's own autocomplete data has entries like "#3",
        // "#3-flyer", "#1-helix" whose "slug" starts with a hash — these are
        // NOT per-product mold pages. Verified live: every one of them
        // resolves to the same generic listing page, because "#" is a URL
        // fragment, not a path segment their site routes on. Confirmed in
        // production: 98 price entries across unrelated discs (Zone SS,
        // Aviar, Berg, Luna, ...) all pointed at discsport.se/discar/mold/#3.
        if (moldSlug && moldSlug.length > 1 && !moldSlug.startsWith('#')) slugs.add(moldSlug);
      }
      return [...slugs];
    }

    // A network blip should not cost the store its whole day, so keep a short
    // retry — but this one is now retrying an actual transient, not a race it
    // cannot win.
    let moldSlugs = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        moldSlugs = await extractMoldSlugs();
      } catch (err) {
        console.warn(`  Attempt ${attempt}/3 failed: ${err.message}`);
        moldSlugs = [];
      }
      if (moldSlugs.length > 0) break;
      if (attempt < 3) {
        console.warn(`  Attempt ${attempt}/3 found 0 mold slugs — retrying in 5s...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    console.log(`  Found ${moldSlugs.length} disc mold slugs`);

    if (moldSlugs.length === 0) {
      console.error('  No mold slugs found after 3 attempts — site structure may have changed');
      return [];
    }

    // ── Step 2: Visit each mold page and scrape variant prices ────────────────
    // 1000+ mold pages, one at a time with a full page navigation each, was
    // the whole reason this scraper always blew the 10-min budget (sequential
    // networkidle waits alone add up to way more than that). Run a small pool
    // of concurrent pages against the same browser context instead — pages
    // are cheap, the site itself is the actual bottleneck either way.
    const CONCURRENCY = 8;
    const allProducts = [];
    const seenKeys = new Set();
    let nextIndex = 0;
    let completed = 0;

    async function scrapeMold(slug) {
      const url = `${STORE.baseUrl}/discar/mold/${slug}`;
      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });

        // Products are in .col children of the Bootstrap row grid
        const products = await page.evaluate(() => {
          const results = [];
          const grid = document.querySelector('.row.row-cols-2');
          if (!grid) return results;

          const cols = grid.querySelectorAll(':scope > .col');
          for (const col of cols) {
            const text = col.innerText || '';
            // Matching against the whole multi-line innerText with \s (which
            // matches newlines too) let the greedy [\d\s]* run glue digits
            // from two separate lines into one bogus price (e.g. Latitude 64
            // Bite showing 63991-64020 kr) whenever nothing but blank lines
            // or another number sat between them. Match a clean single price
            // line instead — the price is always its own line in this grid,
            // same assumption extractNameFromColText() already makes below.
            const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
            const rawPrice = [...lines].reverse().find((l) => /^\d[\d\s]*:-$/.test(l)) || '';
            if (!rawPrice) continue;

            const inStock = !text.includes('Slutsåld');
            results.push({ colText: text, rawPrice, inStock });
          }
          return results;
        });

        for (const p of products) {
          const rawName = extractNameFromColText(p.colText);
          if (!rawName) continue;

          const key = `${rawName}|${slug}`;
          if (seenKeys.has(key)) continue;
          if (isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;

          const sekPrice = parseSekPrice(p.rawPrice);
          if (!sekPrice || sekPrice < 50) continue; // skip accessories

          seenKeys.add(key);
          allProducts.push({
            rawName,
            price: sekPrice,
            productUrl: url,
            inStock: p.inStock,
          });
        }
      } catch (err) {
        if (!err.message.includes('Timeout')) {
          console.warn(`    ⚠ ${slug}: ${err.message}`);
        }
      } finally {
        await page.close();
      }
    }

    async function worker() {
      while (nextIndex < moldSlugs.length) {
        const i = nextIndex++;
        await scrapeMold(moldSlugs[i]);
        completed++;
        if (completed % 50 === 0) {
          console.log(`  Scraped ${completed}/${moldSlugs.length} mold pages...`);
        }
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    console.log(`  Scraped ${allProducts.length} products from ${moldSlugs.length} mold pages`);
    return allProducts;
  } finally {
    await browser.close();
  }
}

// ── Merge results ─────────────────────────────────────────────────────────────

function mergeResults(products, sekToNok, now, fx) {
  // Currency conversion + sanity floor happen here, before the shared merge
  // helper — it expects `product.price` to already be the final NOK price.
  const convertedProducts = products
    .map((p) => ({ ...p, price: Math.round(p.price * sekToNok), image: null }))
    .filter((p) => p.price >= 50); // sanity check on converted NOK (in case rate goes weird)

  return mergeStoreResults({
    products: convertedProducts.map((p) => ({ ...p, store: STORE.key })),
    storeKeys: [STORE.key],
    storeMeta: {
      [STORE.key]: {
        name: STORE.name,
        url: STORE.baseUrl,
        shipping: STORE.shipping,
        country: STORE.country,
        ...fxMeta(fx),
        voec: STORE.voec,
      },
    },
    now,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Discsport scraper — ${now}`);
  console.log('='.repeat(50));

  const fx = await fetchSekToNok();
  const sekToNok = fx.rate;
  const products = await scrape();

  if (products.length === 0) {
    console.error('No products scraped — check selectors or site structure');
    process.exit(1);
  }

  const { matched, unmatched, total } = mergeResults(products, sekToNok, now, fx);
  console.log(`  Matched ${matched} discs, ${unmatched} unmatched (${total} total)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
