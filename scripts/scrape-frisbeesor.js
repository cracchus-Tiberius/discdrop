// scripts/scrape-frisbeesor.js — standalone scraper for frisbeesor.no
// Attempt 1: WooCommerce Store REST API (/wp-json/wc/store/v1/products)
// Attempt 2: Playwright headless Chromium (HTML scraping fallback)
// Usage: node scripts/scrape-frisbeesor.js  or  pnpm scrape:frisbeesor
'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { STORE_CONFIGS, SKIP_CATEGORY_SLUGS, matchDisc, extractVariant, isUsedDisc } = require('./stores.config.js');

const STORE = {
  ...STORE_CONFIGS.frisbeesor,
  // Playwright fallback: "disktype" category has 396 discs (Norwegian slug)
  playwrightCategoryUrls: [
    'https://www.frisbeesor.no/produktkategori/disktype/',
  ],
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'no,nb;q=0.9,en;q=0.8',
  'Cache-Control': 'no-cache',
};

// ── WooCommerce Store API ──────────────────────────────────────────────────────

async function scrapeWithApi() {
  const allProducts = [];
  let page = 1;

  while (true) {
    const url = `${STORE.baseUrl}/wp-json/wc/store/v1/products?per_page=100&page=${page}&orderby=date&order=desc`;
    console.log(`    ${STORE.key} API p${page}: ${url}`);

    let res;
    try {
      res = await fetch(url, { headers: HEADERS, timeout: 15000 });
    } catch (err) {
      console.log(`    → request failed: ${err.message}`);
      return null;
    }

    if (!res.ok) {
      console.log(`    → HTTP ${res.status} — API unavailable`);
      return null;
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      console.log(`    → JSON parse failed: ${err.message}`);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) break;

    for (const item of data) {
      const rawName = item.name;
      if (!rawName) continue;

      // Skip used/second-hand products by name
      if (isUsedDisc(rawName)) continue;

      // Skip products in excluded categories (WooCommerce REST API provides category slugs)
      const categorySlugs = (item.categories || []).map((c) => c.slug);
      if (SKIP_CATEGORY_SLUGS.some((s) => categorySlugs.includes(s))) continue;

      const minorUnit = item.prices?.currency_minor_unit ?? 2;
      const divisor = Math.pow(10, minorUnit);
      const rawPrice = parseInt(item.prices?.price ?? '0', 10);
      const price = rawPrice > 0 ? Math.round(rawPrice / divisor) : null;
      if (!price || price < 50) continue; // skip missing or suspiciously low prices

      const inStock = item.is_in_stock !== false;
      const productUrl = item.permalink || `${STORE.baseUrl}/product/${item.slug}`;
      const image = item.images?.[0]?.src || null;

      allProducts.push({ rawName, price, productUrl, inStock, image });
    }

    // Check total pages from response header
    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    if (page >= totalPages) break;

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

  browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: HEADERS['User-Agent'],
    locale: 'nb-NO',
    extraHTTPHeaders: { 'Accept-Language': 'no,nb;q=0.9,en;q=0.8' },
  });

  try {
    const allProducts = [];
    const seenUrls = new Set();

    for (const categoryUrl of (STORE.playwrightCategoryUrls || STORE.categoryUrls)) {
      let pageUrl = categoryUrl;
      let pageNum = 1;

      while (pageUrl) {
        console.log(`    ${STORE.key} PW p${pageNum}: ${pageUrl}`);
        const page = await context.newPage();
        try {
          await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page.waitForSelector('li.product', { timeout: 15000 }).catch(() => {});

          const { products, nextPage } = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('li.product'));
            const products = [];

            for (const card of cards) {
              const nameEl = card.querySelector('h2.woocommerce-loop-product__title');
              const rawName = nameEl?.textContent?.trim();
              if (!rawName) continue;

              const priceEl = card.querySelector('span.woocommerce-Price-amount bdi');
              const rawPrice = priceEl?.textContent?.trim() || '';
              const cleaned = rawPrice.replace(/[^\d,.]/g, '');
              const normalised = cleaned.replace(/\./g, '').replace(',', '.');
              const price = Math.round(parseFloat(normalised));
              if (!price || isNaN(price)) continue;

              const linkEl = card.querySelector('a.woocommerce-LoopProduct-link');
              const productUrl = linkEl?.href || '';

              const cardText = card.textContent?.toLowerCase() || '';
              const hasOutOfStock = card.classList.contains('out-of-stock') ||
                card.querySelector('.out-of-stock, .button.disabled') !== null;
              const inStock = !hasOutOfStock && !cardText.includes('utsolgt');

              const imgEl = card.querySelector('a.woocommerce-LoopProduct-link img');
              const image = imgEl?.src || imgEl?.dataset?.src || null;

              products.push({ rawName, price, productUrl, inStock, image });
            }

            const nextEl = document.querySelector('a.next.page-numbers');
            const nextPage = nextEl?.href || null;
            return { products, nextPage };
          });

          for (const p of products) {
            if (p.productUrl && !seenUrls.has(p.productUrl) && !isUsedDisc(p.rawName)) {
              seenUrls.add(p.productUrl);
              allProducts.push(p);
            }
          }
          console.log(`    → ${products.length} products (running total: ${allProducts.length})`);

          await page.close();

          if (nextPage && !seenUrls.has(nextPage)) {
            seenUrls.add(nextPage);
            pageUrl = nextPage;
            pageNum++;
            await new Promise(r => setTimeout(r, 1500 + Math.random() * 500));
          } else {
            break;
          }
        } catch (err) {
          await page.close();
          console.warn(`    ⚠ Page error: ${err.message}`);
          break;
        }
      }
    }

    return allProducts;
  } finally {
    await browser.close();
  }
}

// ── Merge results into scraped-prices.json ────────────────────────────────────

function mergeResults(products, now) {
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  let existing = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  // Update store metadata
  existing.stores[STORE.key] = {
    name: STORE.name,
    url: STORE.baseUrl,
    freeShippingOver: STORE.freeShippingOver,
    shipping: STORE.shipping,
  };

  // Remove stale entries for this store
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
        dupe.price = product.price;
        dupe.inStock = product.inStock;
        dupe.url = product.productUrl;
        if (product.image && !dupe.image) dupe.image = product.image;
        dupe.lastScraped = now;
      }
      matched++;
    } else {
      unmatched.push({ store: STORE.key, rawName: product.rawName, price: product.price, url: product.productUrl });
    }
  }

  existing.lastUpdated = now;
  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
  console.log(`✓ Wrote ${dataPath}`);

  // Merge unmatched into unmatched-products.json
  const unmatchedPath = path.join(__dirname, '..', 'data', 'unmatched-products.json');
  let unmatchedFile = { lastUpdated: now, products: [] };
  if (fs.existsSync(unmatchedPath)) {
    try { unmatchedFile = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8')); } catch {}
  }
  unmatchedFile.products = unmatchedFile.products.filter(p => p.store !== STORE.key);
  unmatchedFile.products.push(...unmatched);
  unmatchedFile.lastUpdated = now;
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedFile, null, 2));

  return { matched, unmatched: unmatched.length, total: products.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Frisbee Sør scraper — ${now}`);
  console.log('='.repeat(50));

  let products = null;

  console.log('  Attempt 1: WooCommerce Store REST API');
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

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
