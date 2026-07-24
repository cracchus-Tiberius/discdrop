// scripts/scrape-discexpress.js — standalone scraper for discexpress.se (Shopify)
// Prices are in SEK — converted to NOK using live rate (falls back to 1.00)
// VOEC registered: MVA included at checkout for Norwegian customers
// Shipping to Norway: kr 41
// Usage: node scripts/scrape-discexpress.js  or  pnpm scrape:discexpress
'use strict';

const fetch = require('node-fetch');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');

const STORE = {
  key: 'discexpress',
  name: 'Discexpress',
  baseUrl: 'https://www.discexpress.se',
  shipping: 41,
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
    console.log(`  Could not fetch live rate (${err.message}), using 1.00`);
  }
  return 1.0;
}

// ── Currency assertion ────────────────────────────────────────────────────────
// Discexpress's Shopify storefront geo-localizes currency by client IP.
// GitHub Actions runners hit it from US Azure IPs and got USD prices that
// silently overwrote real NOK data with values 1/10th of reality (the
// 2026-05-03 "kr 24" homepage incident). Pin currency in the URL AND probe a
// single product's .json (which exposes price_currency, unlike the collection
// endpoint) before scraping. Fail loudly if the storefront ignores the pin.
async function assertSekStorefront() {
  const probeColl = `${STORE.baseUrl}/products.json?limit=1&currency=SEK`;
  const r1 = await fetch(probeColl, { headers: HEADERS, timeout: 10000 });
  if (!r1.ok) throw new Error(`Currency probe HTTP ${r1.status}`);
  const handle = (await r1.json())?.products?.[0]?.handle;
  if (!handle) throw new Error('Currency probe: collection returned no products');

  const probeOne = `${STORE.baseUrl}/products/${handle}.json?currency=SEK`;
  const r2 = await fetch(probeOne, { headers: HEADERS, timeout: 10000 });
  if (!r2.ok) throw new Error(`Currency probe (single product) HTTP ${r2.status}`);
  const cur = (await r2.json())?.product?.variants?.[0]?.price_currency;
  if (cur !== 'SEK') {
    throw new Error(
      `Discexpress storefront returned currency "${cur}" (expected SEK). ` +
      `Pinning ?currency=SEK did not stick — refusing to scrape.`
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
    const url = `${STORE.baseUrl}/products.json?limit=250&page=${page}&currency=SEK`;
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
      const url = `${STORE.baseUrl}/products.json?limit=250&page=${page}&currency=SEK`;
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

function mergeResults(products, now) {
  return mergeStoreResults({
    products: products.map((p) => ({ ...p, store: STORE.key })),
    storeKeys: [STORE.key],
    storeMeta: {
      [STORE.key]: {
        name: STORE.name,
        url: STORE.baseUrl,
        shipping: STORE.shipping,
        country: STORE.country,
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
  console.log(`Discexpress scraper — ${now}`);
  console.log('='.repeat(50));

  await assertSekStorefront();
  const sekToNok = await fetchSekToNok();

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

  const { matched, unmatched, total } = mergeResults(products, now);
  console.log(`\nDiscexpress: ${total} products → ${matched} matched, ${unmatched} unmatched`);
}

main().catch(err => { console.error(err); process.exit(1); });
