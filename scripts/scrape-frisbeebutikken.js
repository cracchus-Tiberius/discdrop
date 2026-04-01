'use strict';

// scripts/scrape-frisbeebutikken.js — standalone scraper for frisbeebutikken.no
// Attempt 1: enhanced browser-like headers (site is server-rendered, this is sufficient)
// Attempt 2: Playwright headless Chromium (fallback if bot protection is added later)
//
// Platform: Mystore (custom Norwegian e-commerce, not WooCommerce)
// Products are in [data-price-including-tax] cards with price already as integer NOK.
// Pagination via /categories/golfdisker?&page=N (100 products per page).
//
// Reads existing data/scraped-prices.json, merges results in, writes back.
// Usage: node scripts/scrape-frisbeebutikken.js   or   pnpm scrape:frisbeebutikken

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { extractVariant, isUsedDisc, isMiniDisc, isNonDiscProduct, matchDisc } = require('./stores.config.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randomDelay(min = 2000, max = 5000) { return sleep(min + Math.random() * (max - min)); }

// ── Store config ──────────────────────────────────────────────────────────────

const STORE = {
  key: 'frisbeebutikken',
  name: 'Frisbeebutikken',
  baseUrl: 'https://frisbeebutikken.no',
  freeShippingOver: 699,
  shipping: 45,
  categoryUrl: 'https://frisbeebutikken.no/categories/golfdisker',
};

// ── HTML parsing (Mystore platform) ──────────────────────────────────────────
//
// Product cards: [data-price-including-tax]
//   data-price-including-tax = integer NOK price (no parsing needed)
//   data-manufacturer = brand name
// Inside each card:
//   a.title            → product name (text) and URL (href)
//   a.__product_url    → product URL (href)
//   div.image img[src] → product image
//   div.product[data-quantity] → stock quantity (0 = out of stock)

function parseProductsFromHtml(html) {
  const $ = cheerio.load(html);
  const products = [];

  $('[data-price-including-tax]').each((_, el) => {
    const card = $(el);

    const rawName = card.find('a.title').text().trim();
    if (!rawName) return;

    const price = parseInt(card.attr('data-price-including-tax'), 10);
    if (!price || isNaN(price) || price <= 0) return;

    // Prefer __product_url link, fall back to a.title href
    const linkEl = card.find('a.__product_url, a.title').first();
    const href = linkEl.attr('href') || '';
    const productUrl = href.startsWith('http')
      ? href
      : STORE.baseUrl + (href.startsWith('/') ? '' : '/') + href;

    // data-quantity: 0 = out of stock; missing or >0 = in stock
    const qtyAttr = card.find('[data-quantity]').attr('data-quantity');
    const inStock = qtyAttr === undefined ? true : parseInt(qtyAttr, 10) > 0;

    const image = card.find('div.image img').first().attr('src') || null;

    if (!isUsedDisc(rawName) && !isMiniDisc(rawName) && !isNonDiscProduct(rawName)) products.push({ rawName, price, productUrl, inStock, image });
  });

  // Pagination: look for a.next-page or numbered links in ?&page=N format
  const nextPageHref = $('a[href*="?&page="], a[href*="?page="]')
    .filter((_, el) => {
      const text = $(el).text().trim();
      return text === '»' || /^\d+$/.test(text);
    })
    .last()
    .attr('href');

  // Find the highest page number linked to determine if there are more pages
  let maxPage = 1;
  $('a[href*="?&page="], a[href*="?page="]').each((_, el) => {
    const m = ($(el).attr('href') || '').match(/[?&]page=(\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
  });

  return { products, maxPage };
}

function buildPageUrl(page) {
  if (page <= 1) return STORE.categoryUrl;
  return `${STORE.categoryUrl}?&page=${page}`;
}

// ── Bot-protection detection ──────────────────────────────────────────────────

function isChallengePage(html, productCount) {
  if (productCount > 0) return false;
  const lower = html.toLowerCase();
  return (
    lower.includes('cf-browser-verification') ||
    lower.includes('challenge-running') ||
    lower.includes('just a moment') ||
    lower.includes('enable javascript and cookies to continue') ||
    lower.includes('datadome') ||
    lower.includes('_cf_chl_opt') ||
    lower.includes('perimeterx') ||
    (html.length < 10000)
  );
}

// ── Attempt 1: enhanced fetch headers ────────────────────────────────────────

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language':  'nb-NO,nb;q=0.9,no;q=0.8,nn;q=0.7,en-US;q=0.6,en;q=0.5',
  'Accept-Encoding':  'gzip, deflate, br',
  'DNT':              '1',
  'Connection':       'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest':   'document',
  'Sec-Fetch-Mode':   'navigate',
  'Sec-Fetch-Site':   'none',
  'Sec-Fetch-User':   '?1',
  'sec-ch-ua':        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Cache-Control':    'max-age=0',
};

async function fetchPage(url, referer) {
  const headers = { ...BROWSER_HEADERS };
  if (referer) headers['Referer'] = referer;
  const res = await fetch(url, { headers, timeout: 20000, follow: 5 });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function scrapeWithHeaders() {
  console.log('  Attempt 1: enhanced fetch headers');
  const allProducts = [];
  const seenUrls = new Set();

  // Page 1 — also tells us how many pages exist
  const firstUrl = buildPageUrl(1);
  console.log(`    ${STORE.key} p1: ${firstUrl}`);

  let html;
  try {
    html = await fetchPage(firstUrl, 'https://www.google.no/');
  } catch (err) {
    console.warn(`    ⚠ ${err.message}`);
    return null;
  }

  const { products: firstProducts, maxPage } = parseProductsFromHtml(html);

  if (isChallengePage(html, firstProducts.length)) {
    console.log('    ✗ Bot protection detected — switching to Playwright');
    return null;
  }

  for (const p of firstProducts) {
    if (!seenUrls.has(p.productUrl)) { seenUrls.add(p.productUrl); allProducts.push(p); }
  }
  console.log(`    → ${firstProducts.length} products (max page: ${maxPage})`);

  // Remaining pages
  for (let page = 2; page <= maxPage; page++) {
    await randomDelay(2000, 3000);
    const url = buildPageUrl(page);
    console.log(`    ${STORE.key} p${page}: ${url}`);

    try {
      html = await fetchPage(url, STORE.categoryUrl);
    } catch (err) {
      console.warn(`    ⚠ ${err.message}`);
      break;
    }

    const { products } = parseProductsFromHtml(html);
    if (products.length === 0) break;

    for (const p of products) {
      if (!seenUrls.has(p.productUrl)) { seenUrls.add(p.productUrl); allProducts.push(p); }
    }
    console.log(`    → ${products.length} products (running total: ${allProducts.length})`);
  }

  if (allProducts.length === 0) {
    console.log('    ✗ No products found — switching to Playwright');
    return null;
  }

  console.log(`  Attempt 1 succeeded: ${allProducts.length} products found\n`);
  return allProducts;
}

// ── Attempt 2: Playwright headless browser ────────────────────────────────────

async function scrapeWithPlaywright() {
  console.log('  Attempt 2: Playwright headless browser');

  let pw;
  try {
    pw = require('playwright');
  } catch (_) {
    throw new Error(
      'Playwright is not installed.\n' +
      '  Install it with:\n' +
      '    pnpm add -D playwright\n' +
      '    npx playwright install chromium\n' +
      '  On Ubuntu 24.04 also run:\n' +
      '    sudo apt-get install -y libnspr4 libnss3 libasound2t64'
    );
  }

  const browser = await pw.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    viewport:  { width: 1280, height: 800 },
    userAgent: BROWSER_HEADERS['User-Agent'],
    locale:    'nb-NO',
    extraHTTPHeaders: {
      'Accept-Language':    BROWSER_HEADERS['Accept-Language'],
      'sec-ch-ua':          BROWSER_HEADERS['sec-ch-ua'],
      'sec-ch-ua-mobile':   BROWSER_HEADERS['sec-ch-ua-mobile'],
      'sec-ch-ua-platform': BROWSER_HEADERS['sec-ch-ua-platform'],
    },
  });

  const page = await context.newPage();
  const allProducts = [];
  const seenUrls = new Set();

  try {
    console.log(`    Visiting ${STORE.baseUrl}...`);
    await page.goto(STORE.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 3000);

    // Page 1 — determine max pages
    await page.goto(buildPageUrl(1), { waitUntil: 'networkidle', timeout: 30000 });

    // Natural scroll
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        const step = () => {
          window.scrollBy(0, 120 + Math.floor(Math.random() * 60));
          if (window.scrollY < document.body.scrollHeight * 0.9) {
            setTimeout(step, 80 + Math.floor(Math.random() * 60));
          } else { resolve(); }
        };
        setTimeout(step, 200);
      });
    });
    await sleep(1000);

    const maxPage = await page.evaluate(() => {
      let max = 1;
      document.querySelectorAll('a[href*="?&page="], a[href*="?page="]').forEach((a) => {
        const m = (a.href || '').match(/[?&]page=(\d+)/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return max;
    });

    for (let p = 1; p <= maxPage; p++) {
      if (p > 1) {
        await randomDelay(2000, 4000);
        await page.goto(buildPageUrl(p), { waitUntil: 'networkidle', timeout: 30000 });
        await page.evaluate(async () => {
          await new Promise((resolve) => {
            const step = () => {
              window.scrollBy(0, 120 + Math.floor(Math.random() * 60));
              if (window.scrollY < document.body.scrollHeight * 0.9) {
                setTimeout(step, 80 + Math.floor(Math.random() * 60));
              } else { resolve(); }
            };
            setTimeout(step, 200);
          });
        });
        await sleep(1000);
      }

      const products = await page.evaluate((baseUrl) => {
        return Array.from(document.querySelectorAll('[data-price-including-tax]')).map((card) => {
          const rawName = (card.querySelector('a.title') || {}).textContent || '';
          if (!rawName.trim()) return null;
          const price = parseInt(card.getAttribute('data-price-including-tax') || '0', 10);
          if (!price) return null;
          const linkEl = card.querySelector('a.__product_url, a.title');
          const href = linkEl ? linkEl.getAttribute('href') : '';
          const productUrl = href.startsWith('http') ? href : baseUrl + (href.startsWith('/') ? '' : '/') + href;
          const qtyEl = card.querySelector('[data-quantity]');
          const qty = qtyEl ? parseInt(qtyEl.getAttribute('data-quantity') || '-1', 10) : -1;
          const inStock = qty < 0 ? true : qty > 0;
          const img = card.querySelector('div.image img');
          return {
            rawName: rawName.trim(),
            price,
            productUrl,
            inStock,
            image: img ? img.src : null,
          };
        }).filter(Boolean);
      }, STORE.baseUrl);

      for (const prod of products) {
        if (!seenUrls.has(prod.productUrl) && !isUsedDisc(prod.rawName) && !isMiniDisc(prod.rawName) && !isNonDiscProduct(prod.rawName)) {
          seenUrls.add(prod.productUrl);
          allProducts.push(prod);
        }
      }
      console.log(`    p${p}: ${products.length} products (running total: ${allProducts.length})`);
    }
  } finally {
    await browser.close();
  }

  if (allProducts.length === 0) {
    throw new Error('Playwright returned 0 products — site may still be blocking');
  }

  console.log(`  Attempt 2 succeeded: ${allProducts.length} products found\n`);
  return allProducts;
}

// ── Merge results into scraped-prices.json ───────────────────────────────────

function mergeResults(products, now) {
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');

  let data = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (_) {
      console.warn('  ⚠ Could not parse existing scraped-prices.json — starting fresh');
    }
  }

  data.stores[STORE.key] = {
    name:             STORE.name,
    url:              STORE.baseUrl,
    freeShippingOver: STORE.freeShippingOver,
    shipping:         STORE.shipping,
  };

  // Remove stale entries for this store
  for (const entries of Object.values(data.prices)) {
    const i = entries.findIndex((e) => e.store === STORE.key);
    if (i !== -1) entries.splice(i, 1);
  }

  let matched = 0;
  let unmatched = 0;
  const unmatchedProducts = [];

  for (const product of products) {
    const disc = matchDisc(product.rawName);
    if (disc) {
      if (!data.prices[disc.id]) data.prices[disc.id] = [];
      const variant = extractVariant(product.rawName, disc.brand);
      const existing = data.prices[disc.id].find((e) => e.store === STORE.key && e.plastic === variant.plastic);
      if (!existing) {
        data.prices[disc.id].push({
          store:       STORE.key,
          price:       product.price,
          inStock:     product.inStock,
          url:         product.productUrl,
          image:       product.image || null,
          plastic:     variant.plastic,
          edition:     variant.edition,
          lastScraped: now,
        });
      } else if (product.price < existing.price) {
        existing.price   = product.price;
        existing.inStock = product.inStock;
        existing.url     = product.productUrl;
        if (product.image && !existing.image) existing.image = product.image;
        existing.lastScraped = now;
      }
      matched++;
    } else {
      unmatchedProducts.push({
        store:   STORE.key,
        rawName: product.rawName,
        price:   product.price,
        url:     product.productUrl,
        inStock: product.inStock,
      });
      unmatched++;
    }
  }

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log(`✓ Wrote ${dataPath}`);
  console.log(`  Matched ${matched} discs, ${unmatched} unmatched`);

  const unmatchedPath = path.join(__dirname, '..', 'data', 'unmatched-products.json');
  let unmatchedData = { lastUpdated: now, products: [] };
  if (fs.existsSync(unmatchedPath)) {
    try {
      unmatchedData = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8'));
      unmatchedData.products = unmatchedData.products.filter((p) => p.store !== STORE.key);
    } catch (_) {}
  }
  unmatchedData.products.push(...unmatchedProducts);
  unmatchedData.lastUpdated = now;
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedData, null, 2));
  console.log(`✓ Wrote ${unmatchedPath} (${unmatchedProducts.length} unmatched for review)`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Frisbeebutikken scraper — ${now}`);
  console.log('='.repeat(50));

  let products = await scrapeWithHeaders();

  if (!products) {
    products = await scrapeWithPlaywright();
  }

  mergeResults(products, now);
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
