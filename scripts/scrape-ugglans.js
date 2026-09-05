// scripts/scrape-ugglans.js — standalone scraper for ugglansdiscgolf.se (Shopify)
// Prices are in SEK — converted to NOK using live rate (falls back to 1.03)
// Free shipping within Sweden over 800 SEK; Norway ships too (site offers a
// "Norge (SEK kr)" country/currency option) but no flat rate under 800 SEK is
// published, so we use the ~40-45 kr convention shared by the other SE stores.
// Usage: node scripts/scrape-ugglans.js  or  pnpm scrape:ugglans
'use strict';

const fetch = require('node-fetch');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');
const { fetchSekToNok, fxMeta } = require('./lib/fx.js');

const STORE = {
  key: 'ugglans',
  name: 'Ugglans Discgolf',
  baseUrl: 'https://ugglansdiscgolf.se',
  freeShippingOver: 800,
  shipping: 45,
  country: 'SE',
  currency: 'SEK',
  voec: true,
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'sv,en;q=0.8',
};

// ── SEK → NOK exchange rate ───────────────────────────────────────────────────


// ── Currency assertion ────────────────────────────────────────────────────────
// Shopify storefronts can geo-localize currency by client IP (this bit
// Discexpress in production — see scrape-discexpress.js). Probe a single
// product's .json before scraping and fail loudly if it is not SEK, rather
// than silently writing wrong-currency prices.
//
// Deliberately WITHOUT ?currency=SEK, unlike Discexpress. Confirmed 2026-09-05:
// on this store the parameter does not pin the price, it triggers a Shopify
// conversion from another base currency without the shop's own rounding.
// Same product, same second:
//
//   products.json?currency=SEK   162.24   <- what we were recording
//   products.json                169.00
//   product page JSON-LD         169.00   <- what the customer pays
//
// So the "defence" was making every Ugglans price ~4% too low, flattering the
// store in exactly the ranking this site exists to get right. The probe still
// catches a geo-localized USD storefront on its own: price_currency comes back
// as the served currency either way, and scripts/lib/fx.js's plausibility band
// rejects the resulting rate. Discexpress keeps the parameter — there it is
// verified harmless, 60 of 60 products identical with and without, and it has
// a real incident behind it.
async function assertSekStorefront() {
  const probeColl = `${STORE.baseUrl}/products.json?limit=1`;
  const r1 = await fetch(probeColl, { headers: HEADERS, timeout: 10000 });
  if (!r1.ok) throw new Error(`Currency probe HTTP ${r1.status}`);
  const handle = (await r1.json())?.products?.[0]?.handle;
  if (!handle) throw new Error('Currency probe: collection returned no products');

  const probeOne = `${STORE.baseUrl}/products/${handle}.json`;
  const r2 = await fetch(probeOne, { headers: HEADERS, timeout: 10000 });
  if (!r2.ok) throw new Error(`Currency probe (single product) HTTP ${r2.status}`);
  const cur = (await r2.json())?.product?.variants?.[0]?.price_currency;
  if (cur !== 'SEK') {
    throw new Error(
      `Ugglans storefront returned currency "${cur}" (expected SEK). ` +
      `The storefront is not serving SEK — refusing to scrape.`
    );
  }
  console.log(`  ✓ Currency assertion: storefront returns SEK`);
}

// ── Shopify products.json API ─────────────────────────────────────────────────

function parseShopifyPrice(raw, rate) {
  const n = parseFloat(raw);
  return isNaN(n) ? null : Math.round(n * rate);
}

async function scrapeWithApi(sekToNok) {
  const allProducts = [];
  let page = 1;

  while (true) {
    const url = `${STORE.baseUrl}/products.json?limit=250&page=${page}`;
    console.log(`    ${STORE.key} API p${page}: ${url}`);

    let data;
    try {
      const res = await fetch(url, { headers: HEADERS, timeout: 15000 });
      if (!res.ok) {
        console.log(`    → HTTP ${res.status} — API unavailable`);
        return null;
      }
      data = await res.json();
    } catch (err) {
      console.log(`    → request failed: ${err.message}`);
      return null;
    }

    const products = data.products || [];
    if (products.length === 0) break;

    for (const product of products) {
      const rawName = product.title;
      if (!rawName) continue;
      if (isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;

      const variants = product.variants || [];
      if (variants.length === 0) continue;

      const availableVariants = variants.filter(v => v.available);
      const pool = availableVariants.length ? availableVariants : variants;
      const prices = pool.map(v => parseShopifyPrice(v.price, sekToNok)).filter(p => p && p > 0);
      if (prices.length === 0) continue;

      allProducts.push({
        rawName,
        price: Math.min(...prices),
        productUrl: `${STORE.baseUrl}/products/${product.handle}`,
        inStock: availableVariants.length > 0,
        image: product.images?.[0]?.src || null,
      });
    }

    console.log(`    → page ${page}: ${products.length} products (running total: ${allProducts.length})`);
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
    page++;
  }

  return allProducts;
}

// ── Playwright fallback ────────────────────────────────────────────────────────

async function scrapeWithPlaywright(sekToNok) {
  let playwright, browser;
  try {
    playwright = require('playwright');
  } catch {
    console.log('    → Playwright not installed (run: npx playwright install chromium)');
    return null;
  }

  browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: HEADERS['User-Agent'],
    locale: 'sv-SE',
    extraHTTPHeaders: { 'Accept-Language': 'sv,en;q=0.8' },
  });

  try {
    const allProducts = [];
    let page = 1;

    while (true) {
      const url = `${STORE.baseUrl}/products.json?limit=250&page=${page}`;
      console.log(`    ${STORE.key} PW p${page}: ${url}`);
      const pwPage = await context.newPage();
      try {
        await pwPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const body = await pwPage.evaluate(() => document.body.textContent);
        const data = JSON.parse(body);
        const products = data.products || [];
        if (products.length === 0) { await pwPage.close(); break; }

        for (const product of products) {
          const rawName = product.title;
          if (!rawName || isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;
          const variants = product.variants || [];
          const avail = variants.filter(v => v.available);
          const pool = avail.length ? avail : variants;
          const prices = pool.map(v => parseShopifyPrice(v.price, sekToNok)).filter(p => p && p > 0);
          if (!prices.length) continue;
          allProducts.push({
            rawName,
            price: Math.min(...prices),
            productUrl: `${STORE.baseUrl}/products/${product.handle}`,
            inStock: avail.length > 0,
            image: product.images?.[0]?.src || null,
          });
        }
        console.log(`    → ${products.length} products (running total: ${allProducts.length})`);
        await pwPage.close();
        await new Promise(r => setTimeout(r, 1000));
        page++;
      } catch (err) {
        await pwPage.close();
        console.warn(`    ⚠ Page error: ${err.message}`);
        break;
      }
    }

    return allProducts;
  } finally {
    await browser.close();
  }
}

// ── Merge results ─────────────────────────────────────────────────────────────

function mergeResults(products, now, fx) {
  return mergeStoreResults({
    products: products.map((p) => ({ ...p, store: STORE.key })),
    storeKeys: [STORE.key],
    storeMeta: {
      [STORE.key]: {
        name: STORE.name,
        url: STORE.baseUrl,
        freeShippingOver: STORE.freeShippingOver,
        shipping: STORE.shipping,
        country: STORE.country,
        ...fxMeta(fx),
        currency: STORE.currency,
        voec: STORE.voec,
      },
    },
    now,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Ugglans Discgolf scraper — ${now}`);
  console.log('='.repeat(50));

  await assertSekStorefront();
  const fx = await fetchSekToNok();
  const sekToNok = fx.rate;

  let products = null;

  console.log('  Attempt 1: Shopify products.json API');
  products = await scrapeWithApi(sekToNok);

  if (products && products.length > 0) {
    console.log(`  Attempt 1 succeeded: ${products.length} products found`);
  } else {
    console.log('  Attempt 1 failed. Trying Playwright...');
    console.log('  Attempt 2: Playwright headless Chromium');
    products = await scrapeWithPlaywright(sekToNok);
    if (products && products.length > 0) {
      console.log(`  Attempt 2 succeeded: ${products.length} products found`);
    } else {
      console.error('  Both attempts failed — no products scraped');
      process.exit(1);
    }
  }

  const { matched, unmatched, total } = mergeResults(products, now, fx);
  console.log(`\nUgglans Discgolf: ${total} products → ${matched} matched, ${unmatched} unmatched`);
}

main().catch(err => { console.error(err); process.exit(1); });
