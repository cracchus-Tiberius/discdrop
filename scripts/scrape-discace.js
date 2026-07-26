// scripts/scrape-discace.js — standalone scraper for discace.se (WooCommerce)
// Prices are in SEK — converted to NOK using live rate (falls back to 1.03)
// Shipping to Norway: 29 SEK, free over 700 SEK (per discgolfa.se directory)
// Discace runs a "Disc Replay" category of used/second-hand discs
// (slug pattern "begagnade-*") — excluded via both the shared USED_KEYWORDS
// list (isUsedDisc) and a local category-slug substring check, belt-and-braces.
// Attempt 1: WooCommerce Store REST API (/wp-json/wc/store/v1/products)
// Attempt 2: Playwright headless Chromium (HTML scraping fallback)
// Usage: node scripts/scrape-discace.js  or  pnpm scrape:discace
'use strict';

const fetch = require('node-fetch');
const { SKIP_CATEGORY_SLUGS, isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');

const STORE = {
  key: 'discace',
  name: 'Discace of Sweden',
  // discace.se 302-redirects through a chain that loses the X-WP-TotalPages
  // header (silently truncating results to page 1) — use the real domain
  // directly instead of relying on the redirect to resolve it.
  baseUrl: 'https://discaceofsweden.com',
  freeShippingOver: 700,
  shipping: 29,
  country: 'SE',
  currency: 'SEK',
  voec: true,
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'sv,en;q=0.8',
  'Cache-Control': 'no-cache',
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
    console.log(`  Could not fetch live rate (${err.message}), using 1.03`);
  }
  return 1.03;
}

function isUsedCategorySlug(slugs) {
  return slugs.some((s) => s.includes('begagnad') || s.includes('disc-replay'));
}

// ── WooCommerce Store API ──────────────────────────────────────────────────────

async function scrapeWithApi(sekToNok) {
  const allProducts = [];
  let page = 1;

  while (true) {
    const url = `${STORE.baseUrl}/wp-json/wc/store/v1/products?per_page=100&page=${page}&orderby=id&order=asc`;
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

      if (isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;

      const categorySlugs = (item.categories || []).map((c) => c.slug);
      if (SKIP_CATEGORY_SLUGS.some((s) => categorySlugs.includes(s))) continue;
      if (isUsedCategorySlug(categorySlugs)) continue;

      const currency = item.prices?.currency_code;
      if (currency && currency !== 'SEK') continue; // unexpected currency — skip rather than misconvert

      const minorUnit = item.prices?.currency_minor_unit ?? 2;
      const divisor = Math.pow(10, minorUnit);
      const rawPrice = parseInt(item.prices?.price ?? '0', 10);
      const sekPrice = rawPrice > 0 ? rawPrice / divisor : null;
      const price = sekPrice ? Math.round(sekPrice * sekToNok) : null;
      if (!price || price < 50) continue; // skip missing or suspiciously low prices

      const inStock = item.is_in_stock !== false;
      const productUrl = item.permalink || `${STORE.baseUrl}/produkt/${item.slug}`;
      const image = item.images?.[0]?.src || null;

      allProducts.push({ rawName, price, productUrl, inStock, image });
    }

    const totalPages = parseInt(res.headers.get('x-wp-totalpages') || '1', 10);
    if (page >= totalPages) break;

    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 500));
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
    const seenUrls = new Set();

    let pageUrl = `${STORE.baseUrl}/butik/`;
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
            const nameEl = card.querySelector('h2.woocommerce-loop-product__title, h3.woocommerce-loop-product__title');
            const rawName = nameEl?.textContent?.trim();
            if (!rawName) continue;

            const priceEl = card.querySelector('span.woocommerce-Price-amount bdi, span.woocommerce-Price-amount');
            const rawPrice = priceEl?.textContent?.trim() || '';
            const cleaned = rawPrice.replace(/[^\d,.]/g, '');
            const normalised = cleaned.replace(/\./g, '').replace(',', '.');
            const price = Math.round(parseFloat(normalised));
            if (!price || isNaN(price)) continue;

            const linkEl = card.querySelector('a.woocommerce-LoopProduct-link, a.woocommerce-loop-product__link');
            const productUrl = linkEl?.href || '';

            const cardClasses = card.className || '';
            const cardText = card.textContent?.toLowerCase() || '';
            const hasOutOfStock = card.classList.contains('out-of-stock') ||
              card.querySelector('.out-of-stock, .button.disabled') !== null;
            const inStock = !hasOutOfStock && !cardText.includes('slut i lager');
            const isUsedCategory = cardClasses.includes('begagnad') || cardClasses.includes('disc-replay');

            const imgEl = card.querySelector('img');
            const image = imgEl?.src || imgEl?.dataset?.src || null;

            products.push({ rawName, price, productUrl, inStock, image, isUsedCategory });
          }

          const nextEl = document.querySelector('a.next.page-numbers');
          const nextPage = nextEl?.href || null;
          return { products, nextPage };
        });

        for (const p of products) {
          if (p.isUsedCategory) continue;
          if (p.productUrl && !seenUrls.has(p.productUrl) && !isUsedDisc(p.rawName) && !isMiniDisc(p.rawName) && !isNonDiscProduct(p.rawName)) {
            seenUrls.add(p.productUrl);
            allProducts.push({ ...p, price: Math.round(p.price * sekToNok) });
          }
        }
        console.log(`    → ${products.length} products (running total: ${allProducts.length})`);

        await page.close();

        if (nextPage && !seenUrls.has(nextPage)) {
          seenUrls.add(nextPage);
          pageUrl = nextPage;
          pageNum++;
          await new Promise((r) => setTimeout(r, 1500 + Math.random() * 500));
        } else {
          break;
        }
      } catch (err) {
        await page.close();
        console.warn(`    ⚠ Page error: ${err.message}`);
        break;
      }
    }

    return allProducts;
  } finally {
    await browser.close();
  }
}

// ── Merge results into scraped-prices.json ────────────────────────────────────

function mergeResults(products, now) {
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
        currency: STORE.currency,
        voec: STORE.voec,
      },
    },
    now,
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Discace of Sweden scraper — ${now}`);
  console.log('='.repeat(50));

  const sekToNok = await fetchSekToNok();

  let products = null;

  console.log('  Attempt 1: WooCommerce Store REST API');
  products = await scrapeWithApi(sekToNok);

  if (products && products.length > 0) {
    console.log(`  Attempt 1 succeeded: ${products.length} products found`);
  } else {
    console.log('  Attempt 1 returned no products — falling back to Playwright');
    console.log('  Attempt 2: Playwright headless browser');
    products = await scrapeWithPlaywright(sekToNok);
    if (!products || products.length === 0) {
      console.error('  Both attempts failed — no products scraped');
      process.exit(1);
    }
    console.log(`  Attempt 2 succeeded: ${products.length} products found`);
  }

  const { matched, unmatched, total } = mergeResults(products, now);
  console.log(`  Matched ${matched} discs, ${unmatched} unmatched (${total} total)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
