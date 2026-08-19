// scripts/scrape-discsport.js — scraper for discsport.se (custom platform)
// Platform: custom Angular/server-rendered — requires Playwright
// Currency: SEK → converted to NOK with live rate (~1:1)
// Shipping to Norway: 39 SEK ≈ 40 NOK — VOEC registered (MVA inkl.)
// Usage: node scripts/scrape-discsport.js  or  pnpm scrape:discsport
'use strict';

const fetch = require('node-fetch');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');

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

async function fetchSekToNok() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/SEK', { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.NOK;
    if (rate && rate > 0) {
      console.log(`  SEK/NOK rate: ${rate.toFixed(4)}`);
      return rate;
    }
  } catch (err) {
    console.log(`  Could not fetch live rate (${err.message}), using 1.03`);
  }
  return 1.03; // fallback: 1 SEK ≈ 1.03 NOK
}

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
    async function extractMoldSlugs() {
      const indexPage = await context.newPage();
      indexPage.on('dialog', d => d.dismiss().catch(() => {}));
      try {
        // Use the Swedish path — /no/ prefix breaks mold page filtering
        await indexPage.goto(`${STORE.baseUrl}/discar`, { waitUntil: 'domcontentloaded', timeout: 30000 });

        return await indexPage.evaluate(() => {
          const scripts = Array.from(document.querySelectorAll('script'));
          const slugs = new Set();
          for (const script of scripts) {
            const text = script.textContent || '';
            const matches = text.matchAll(/"[^"]*##\d+##2##discar\/mold\/([^"\s]+)[^"]*"/g);
            for (const m of matches) {
              const moldSlug = m[1];
              // Discsport's own autocomplete data has entries like "#3",
              // "#3-flyer", "#1-helix" whose "slug" starts with a hash — these
              // are NOT per-product mold pages. Verified live: every single
              // one of them (not just the bare "#3" case) resolves to the
              // exact same generic listing page (DISCatcher Traveler, a
              // starter bag, Active Premium Majesty/Magician/...), because "#"
              // is a URL fragment, not a real path segment their site routes
              // on when loaded directly. Confirmed in production: 98 price
              // entries across completely unrelated discs (Zone SS, Aviar,
              // Berg, Luna, ...) all ended up pointing at discsport.se/discar/
              // mold/#3, making every price attributed to it unverifiable —
              // reject the whole "starts with #" family, not just that one.
              if (moldSlug && moldSlug.length > 1 && !moldSlug.startsWith('#')) {
                slugs.add(moldSlug);
              }
            }
          }
          return [...slugs];
        });
      } finally {
        await indexPage.close();
      }
    }

    // Confirmed in production 2026-08-18: the catalogue page (which now
    // 301-redirects /discar -> /discar/alla) came back with 0 mold slugs on
    // the daily GA run despite the page and its data being fine both before
    // and after (reproduced live minutes after the failure: 997 slugs, no
    // code or site change needed). A single transient load/redirect hiccup
    // used to kill the whole store for the day with zero retry — 3 attempts
    // with a short backoff costs a few seconds on a run that already takes
    // several minutes, and turns a one-off blip back into a normal day
    // instead of a full missed scrape.
    let moldSlugs = [];
    for (let attempt = 1; attempt <= 3; attempt++) {
      moldSlugs = await extractMoldSlugs();
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

function mergeResults(products, sekToNok, now) {
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

  const sekToNok = await fetchSekToNok();
  const products = await scrape();

  if (products.length === 0) {
    console.error('No products scraped — check selectors or site structure');
    process.exit(1);
  }

  const { matched, unmatched, total } = mergeResults(products, sekToNok, now);
  console.log(`  Matched ${matched} discs, ${unmatched} unmatched (${total} total)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
