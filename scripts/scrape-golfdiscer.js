// scripts/scrape-golfdiscer.js — standalone scraper for golfdiscer.no (Shopify)
// Attempt 1: Shopify public products.json API
// Attempt 2: Playwright headless Chromium
// Usage: node scripts/scrape-golfdiscer.js  or  pnpm scrape:golfdiscer
'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { matchDisc, extractVariant, isUsedDisc, isMiniDisc } = require('./stores.config.js');

const STORE = {
  key: 'golfdiscer',
  name: 'GolfDiscer',
  baseUrl: 'https://golfdiscer.no',
  freeShippingOver: 799,
  shipping: 45,
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'no,nb;q=0.9,en;q=0.8',
};

// ── Shopify products.json API ─────────────────────────────────────────────────

function parseShopifyPrice(raw) {
  const n = parseFloat(raw);
  return isNaN(n) ? null : Math.round(n);
}

async function scrapeWithApi() {
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

      const variants = product.variants || [];
      if (variants.length === 0) continue;

      const availableVariants = variants.filter(v => v.available);
      const pool = availableVariants.length ? availableVariants : variants;
      const prices = pool.map(v => parseShopifyPrice(v.price)).filter(p => p && p > 0);
      if (prices.length === 0) continue;

      const price = Math.min(...prices);
      const inStock = availableVariants.length > 0;
      const productUrl = `${STORE.baseUrl}/products/${product.handle}`;
      const image = product.images?.[0]?.src || null;

      if (!isUsedDisc(rawName) && !isMiniDisc(rawName)) allProducts.push({ rawName, price, productUrl, inStock, image });
    }

    await new Promise(r => setTimeout(r, 1000 + Math.random() * 500));
    page++;
  }

  return allProducts;
}

// ── Playwright fallback ────────────────────────────────────────────────────────

async function scrapeWithPlaywright() {
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
    locale: 'nb-NO',
    extraHTTPHeaders: { 'Accept-Language': 'no,nb;q=0.9,en;q=0.8' },
  });

  try {
    const allProducts = [];
    let page = 1;

    while (true) {
      const url = `${STORE.baseUrl}/products.json?limit=250&page=${page}`;
      console.log(`    ${STORE.key} PW p${page}: ${url}`);
      const pwPage = await context.newPage();
      try {
        const res = await pwPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const body = await pwPage.evaluate(() => document.body.textContent);
        const data = JSON.parse(body);
        const products = data.products || [];
        if (products.length === 0) { await pwPage.close(); break; }

        for (const product of products) {
          const rawName = product.title;
          if (!rawName) continue;
          const variants = product.variants || [];
          const avail = variants.filter(v => v.available);
          const pool = avail.length ? avail : variants;
          const prices = pool.map(v => parseFloat(v.price)).filter(p => !isNaN(p) && p > 0);
          if (!prices.length) continue;
          if (!isUsedDisc(rawName)) allProducts.push({
            rawName,
            price: Math.round(Math.min(...prices)),
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
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  let existing = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  existing.stores[STORE.key] = {
    name: STORE.name, url: STORE.baseUrl,
    freeShippingOver: STORE.freeShippingOver, shipping: STORE.shipping,
  };

  for (const discId of Object.keys(existing.prices)) {
    existing.prices[discId] = existing.prices[discId].filter(e => e.store !== STORE.key);
    if (existing.prices[discId].length === 0) delete existing.prices[discId];
  }

  let matched = 0;
  const unmatched = [];

  for (const product of products) {
    const disc = matchDisc(product.rawName);
    if (disc) {
      if (!existing.prices[disc.id]) existing.prices[disc.id] = [];
      const variant = extractVariant(product.rawName, disc.brand);
      const dupe = existing.prices[disc.id].find(e => e.store === STORE.key && e.plastic === variant.plastic);
      if (!dupe) {
        existing.prices[disc.id].push({ store: STORE.key, price: product.price, inStock: product.inStock, url: product.productUrl, image: product.image || null, plastic: variant.plastic, edition: variant.edition, lastScraped: now });
      } else if (product.price < dupe.price) {
        Object.assign(dupe, { price: product.price, inStock: product.inStock, url: product.productUrl, lastScraped: now });
        if (product.image && !dupe.image) dupe.image = product.image;
      }
      matched++;
    } else {
      unmatched.push({ store: STORE.key, rawName: product.rawName, price: product.price, url: product.productUrl });
    }
  }

  existing.lastUpdated = now;
  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
  console.log(`✓ Wrote ${dataPath}`);

  const unmatchedPath = path.join(__dirname, '..', 'data', 'unmatched-products.json');
  let unmatchedFile = { lastUpdated: now, products: [] };
  if (fs.existsSync(unmatchedPath)) { try { unmatchedFile = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8')); } catch {} }
  unmatchedFile.products = unmatchedFile.products.filter(p => p.store !== STORE.key);
  unmatchedFile.products.push(...unmatched);
  unmatchedFile.lastUpdated = now;
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedFile, null, 2));

  return { matched, unmatched: unmatched.length, total: products.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`GolfDiscer scraper — ${now}`);
  console.log('='.repeat(50));

  let products = null;

  console.log('  Attempt 1: Shopify products.json API');
  products = await scrapeWithApi();

  if (products && products.length > 0) {
    console.log(`  Attempt 1 succeeded: ${products.length} products found`);
  } else {
    console.log('  Attempt 1 returned no products — falling back to Playwright');
    console.log('  Attempt 2: Playwright headless browser');
    products = await scrapeWithPlaywright();
    if (!products || products.length === 0) {
      console.error('  Both attempts failed — no products scraped');
      process.exit(1);
    }
    console.log(`  Attempt 2 succeeded: ${products.length} products found`);
  }

  const { matched, unmatched, total } = mergeResults(products, now);
  console.log(`  Matched ${matched} discs, ${unmatched} unmatched (${total} total)`);
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
