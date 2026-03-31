// scripts/scrape-rocketdiscs.js — standalone scraper for rocketdiscs.com
// Strategy:
//   1. Playwright loads each brand page, extracts ModelIds from Buy-Disc button IDs
//   2. POST /Cart/DiscStock per ModelId → clean JSON with prices + stock per plastic
// Prices are in EUR — converted to NOK using live rate
// Shipping to Norway: kr 67 / VOEC registered
// Usage: node scripts/scrape-rocketdiscs.js  or  pnpm scrape:rocketdiscs
'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { matchDisc, extractVariant, isUsedDisc, isMiniDisc } = require('./stores.config.js');

const STORE = {
  key: 'rocketdiscs',
  name: 'Rocketdiscs',
  baseUrl: 'https://rocketdiscs.com',
  shipping: 67,
  country: 'SE',
  currency: 'EUR',
  voec: true,
};

const BRAND_SLUGS = [
  'innova',
  'discraft',
  'kastaplast',
  'mvp',
  'axiom',
  'discmania',
  'dynamic-discs',
  'latitude-64',
  'westside-discs',
  'prodigy',
  'thought-space-athletics',
  'streamline',
  'clash-discs',
  'prodiscus',
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── EUR → NOK exchange rate ───────────────────────────────────────────────────

async function fetchEurToNok() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.NOK;
    if (rate && rate > 0) {
      console.log(`  EUR/NOK rate: ${rate.toFixed(4)}`);
      return rate;
    }
  } catch (err) {
    console.log(`  Could not fetch live rate (${err.message}), using 11.80`);
  }
  return 11.80;
}

// ── Step 1: extract ModelIds from brand page ──────────────────────────────────

async function getModelIdsForBrand(context, slug) {
  const url = `${STORE.baseUrl}/brand/${slug}`;
  const page = await context.newPage();
  const models = [];

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('.pod', { timeout: 15000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.pod')).map(pod => {
        const btn = pod.querySelector('[id^="Buy-Disc-"]');
        const nameEl = pod.querySelector('.text h4 a');
        const href = nameEl?.getAttribute('href') || null;
        const name = nameEl?.textContent?.trim() || null;

        // In-stock: Buy-Disc button present and no pre-owned-only state
        const hasBuy = !!btn;
        const preOwned = !!pod.querySelector('.preOwned');

        const idAttr = btn?.id || '';
        const modelId = idAttr.replace('Buy-Disc-', '') || null;

        return { modelId, name, href, hasBuy, preOwned };
      });
    });

    for (const m of raw) {
      if (m.modelId && m.name && !m.preOwned) {
        const productUrl = m.href
          ? (m.href.startsWith('http') ? m.href : `${STORE.baseUrl}${m.href}`)
          : `${STORE.baseUrl}/${slug}-${m.name.toLowerCase().replace(/\s+/g, '-')}`;
        models.push({ modelId: m.modelId, name: m.name, productUrl, hasStock: m.hasBuy });
      }
    }

    console.log(`    ${slug}: ${models.length} models`);
  } catch (err) {
    console.warn(`    ⚠ ${slug}: ${err.message}`);
  } finally {
    await page.close();
  }

  return models;
}

// ── Step 2: fetch stock/price per model via /Cart/DiscStock ──────────────────
// Reuses a single page already on rocketdiscs.com so relative URL resolves

async function fetchDiscStock(apiPage, modelId) {
  try {
    const result = await apiPage.evaluate(async (id) => {
      const res = await fetch('/Cart/DiscStock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ModelId: id }),
      });
      return await res.json();
    }, modelId);

    return result?.data || [];
  } catch {
    return [];
  }
}

// ── Main scrape logic ─────────────────────────────────────────────────────────

async function scrape(eurToNok) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.log('    → Playwright not installed (run: npx playwright install chromium)');
    return null;
  }

  const browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'en-US',
    baseURL: STORE.baseUrl,
  });

  // Warm up session and keep page open on the site for API calls
  const apiPage = await context.newPage();
  await apiPage.goto(STORE.baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});

  const allProducts = [];

  try {
    // Step 1: collect all ModelIds across all brands
    const allModels = [];
    for (const slug of BRAND_SLUGS) {
      const models = await getModelIdsForBrand(context, slug);
      allModels.push(...models);
      await new Promise(r => setTimeout(r, 2000));
    }
    console.log(`\n  Total models found: ${allModels.length}`);

    // Step 2: fetch stock for each model using the persistent apiPage
    console.log('  Fetching stock/prices from /Cart/DiscStock...');
    let fetched = 0;
    for (const model of allModels) {
      const variants = await fetchDiscStock(apiPage, model.modelId);

      for (const v of variants) {
        if (!v.StockAvailable) continue;
        if (isUsedDisc(v.ModelName) || isMiniDisc(v.ModelName)) continue;
        if (v.ItemConditionScale !== null && v.ItemConditionScale !== undefined) continue; // pre-owned

        const price = Math.round((v.StockPrice || 0) * eurToNok);
        if (!price || price < 50) continue;

        const rawName = `${v.PlasticName} ${v.ModelName}`;
        const image = v.StockImage ? `${STORE.baseUrl}${v.StockImage}` : null;

        allProducts.push({
          rawName,
          price,
          productUrl: model.productUrl,
          inStock: true,
          image,
        });
      }

      fetched++;
      if (fetched % 20 === 0) console.log(`    ${fetched}/${allModels.length} models fetched...`);
      await new Promise(r => setTimeout(r, 300));
    }
  } finally {
    await apiPage.close();
    await browser.close();
  }

  return allProducts;
}

// ── Merge results ─────────────────────────────────────────────────────────────

function mergeResults(products, now) {
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  let existing = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  existing.stores[STORE.key] = {
    name: STORE.name,
    url: STORE.baseUrl,
    shipping: STORE.shipping,
    country: STORE.country,
    currency: STORE.currency,
    voec: STORE.voec,
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
        existing.prices[disc.id].push({
          store: STORE.key,
          price: product.price,
          inStock: product.inStock,
          url: product.productUrl,
          image: product.image || null,
          plastic: variant.plastic,
          edition: variant.edition,
          lastScraped: now,
        });
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
  console.log(`Rocketdiscs scraper — ${now}`);
  console.log('='.repeat(50));

  const eurToNok = await fetchEurToNok();

  const products = await scrape(eurToNok);
  if (!products || products.length === 0) {
    console.error('  No products scraped');
    process.exit(1);
  }

  console.log(`\n  Total in-stock variants: ${products.length}`);
  const { matched, unmatched, total } = mergeResults(products, now);
  console.log(`\nRocketdiscs: ${total} products → ${matched} matched, ${unmatched} unmatched`);
}

main().catch(err => { console.error(err); process.exit(1); });
