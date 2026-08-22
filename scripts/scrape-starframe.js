'use strict';

// scripts/scrape-starframe.js — standalone scraper for starframe.no
// Attempt 1: enhanced browser-like headers (site is server-rendered, this is sufficient)
// Attempt 2: Playwright headless Chromium (fallback if bot protection is added later)
//
// Platform: Mystore — same platform as Frisbeebutikken (frisbeebutikken.no),
// confirmed live 2026-08-19: product data lives inline in each card's
// `@click="... addToCart({...})"` Alpine.js handler as a JS object literal
// (name/price/url/image/brand), identical field names and price format
// ("189,-") to Frisbeebutikken. parseProductsFromHtml() below is a
// near-verbatim copy of that scraper's — keep both in sync if the Mystore
// markup ever changes for one of them.
// Category listing (/categories/typer) is disc-only — every sampled product
// carries category: 'Discer'. No "utsolgt"/out-of-stock markers found in
// sampled pages, so inStock is always true here (same caveat as
// Frisbeebutikken: if that assumption turns out wrong, genuinely
// out-of-stock discs would incorrectly show as available).
// Pagination: page 1 is the bare category URL, page N (N>=2) is
// /categories/typer/sort-by/1/?page=N — different URL shape from
// Frisbeebutikken's `?&page=N` but same underlying page-number param.
//
// Shipping: "frakt fra 50 kr eller gratis henting i Hamar" (starframe.no) —
// no confirmed free-shipping-over threshold, so freeShippingOver is
// intentionally omitted rather than guessed.
//
// Reads existing data/scraped-prices.json, merges results in, writes back.
// Usage: node scripts/scrape-starframe.js   or   pnpm scrape:starframe

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function randomDelay(min = 2000, max = 5000) { return sleep(min + Math.random() * (max - min)); }

// ── Store config ──────────────────────────────────────────────────────────────

const STORE = {
  key: 'starframe',
  name: 'Starframe',
  baseUrl: 'https://www.starframe.no',
  shipping: 50,
  categoryUrl: 'https://www.starframe.no/categories/typer',
};

// ── HTML parsing (Mystore platform) — see scrape-frisbeebutikken.js's
// parseProductsFromHtml() for the full explanation of this format. ──────────

function parseProductsFromHtml(html) {
  const products = [];
  const blockRe = /addToCart\(\{([\s\S]*?)\}\)/g;
  let match;

  while ((match = blockRe.exec(html)) !== null) {
    const block = match[1];
    const nameM = block.match(/name:\s*'([^']*)'/);
    const priceM = block.match(/price:\s*'([^']*)'/);
    const urlM = block.match(/url:\s*'([^']*)'/);
    const imageM = block.match(/image:\s*'([^']*)'/);
    if (!nameM || !priceM || !urlM) continue;

    const rawName = nameM[1].trim();
    if (!rawName) continue;

    const price = parseInt(priceM[1].replace(/[^\d]/g, ''), 10);
    if (!price || isNaN(price) || price < 50) continue; // skip suspiciously low prices (used/clearance/parsing error)

    const productUrl = urlM[1];
    const image = imageM ? imageM[1] : null;

    if (!isUsedDisc(rawName) && !isMiniDisc(rawName) && !isNonDiscProduct(rawName)) {
      products.push({ rawName, price, productUrl, inStock: true, image });
    }
  }

  const $ = cheerio.load(html);
  let maxPage = 1;
  $('a[href*="?page="]').each((_, el) => {
    const m = ($(el).attr('href') || '').match(/[?&]page=(\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
  });

  return { products, maxPage };
}

function buildPageUrl(page) {
  if (page <= 1) return STORE.categoryUrl;
  return `${STORE.categoryUrl}/sort-by/1/?page=${page}`;
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

// Confirmed in production 2026-08-22: page 1 timed out on attempt 1, AND the
// Playwright fallback's initial page.goto also timed out (30s) in the same
// run — both platform-side attempts failing together in one ~10-minute
// window (alongside Frisbeebutikken on the same Mystore platform, and
// wearediscgolf on an unrelated platform) points at a transient runner/
// network blip, not a site break. 2 retries with a short backoff here costs
// seconds and can avoid needing the much heavier Playwright fallback at all.
async function fetchPage(url, referer, attempts = 2) {
  const headers = { ...BROWSER_HEADERS };
  if (referer) headers['Referer'] = referer;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { headers, timeout: 20000, follow: 5 });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt === attempts) throw err;
      console.warn(`    ⚠ Attempt ${attempt}/${attempts} failed to fetch ${url}: ${err.message} — retrying in 3s`);
      await sleep(3000);
    }
  }
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

  let { products: firstProducts, maxPage } = parseProductsFromHtml(html);

  if (isChallengePage(html, firstProducts.length)) {
    console.log('    ✗ Bot protection detected — switching to Playwright');
    return null;
  }

  // Same transient-pagination defense as scrape-frisbeebutikken.js (see its
  // 2026-08-18 incident comment) — re-verify a suspicious maxPage===1
  // before trusting it as "this is the whole catalog".
  if (maxPage === 1) {
    await randomDelay(1000, 2000);
    let retryHtml;
    try {
      retryHtml = await fetchPage(firstUrl, 'https://www.google.no/');
    } catch {
      retryHtml = null;
    }
    if (retryHtml) {
      const retry = parseProductsFromHtml(retryHtml);
      if (retry.maxPage > maxPage) {
        console.log(`    ⚠ Page 1 retry found ${retry.maxPage} pages (first attempt saw ${maxPage}) — using the higher count`);
        html = retryHtml;
        firstProducts = retry.products;
        maxPage = retry.maxPage;
      }
    }
  }

  for (const p of firstProducts) {
    if (!seenUrls.has(p.productUrl)) { seenUrls.add(p.productUrl); allProducts.push(p); }
  }
  console.log(`    → ${firstProducts.length} products (max page: ${maxPage})`);

  for (let page = 2; page <= maxPage; page++) {
    await randomDelay(2000, 3000);
    const url = buildPageUrl(page);
    console.log(`    ${STORE.key} p${page}: ${url}`);

    try {
      html = await fetchPage(url, STORE.categoryUrl);
    } catch (err) {
      console.warn(`    ⚠ Page ${page}/${maxPage} failed (${allProducts.length} products collected so far): ${err.message}`);
      return null;
    }

    const { products } = parseProductsFromHtml(html);

    if (isChallengePage(html, products.length)) {
      console.log(`    ✗ Bot protection detected on page ${page}/${maxPage} (${allProducts.length} products collected so far) — switching to Playwright`);
      return null;
    }

    if (products.length === 0) {
      console.warn(`    ⚠ Page ${page}/${maxPage} returned 0 products, but page 1 reported ${maxPage} pages exist (${allProducts.length} products collected so far)`);
      return null;
    }

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
    // Just a "look like a real visitor" warm-up before the category page —
    // not itself a data source, so a timeout here (confirmed in production
    // 2026-08-22, same run as fetchPage's retries above) shouldn't abort the
    // whole attempt when the actual category page load right after it might
    // still succeed fine.
    try {
      console.log(`    Visiting ${STORE.baseUrl}...`);
      await page.goto(STORE.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await randomDelay(2000, 3000);
    } catch (err) {
      console.warn(`    ⚠ Warm-up visit to ${STORE.baseUrl} failed (${err.message}) — continuing to category page anyway`);
    }

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
      document.querySelectorAll('a[href*="?page="]').forEach((a) => {
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

      const pageHtml = await page.content();
      const { products } = parseProductsFromHtml(pageHtml);

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
  const result = mergeStoreResults({
    products: products.map((p) => ({ ...p, store: STORE.key })),
    storeKeys: [STORE.key],
    storeMeta: {
      [STORE.key]: {
        name: STORE.name,
        url: STORE.baseUrl,
        shipping: STORE.shipping,
      },
    },
    now,
  });
  console.log(`  Matched ${result.matched} discs, ${result.unmatched} unmatched`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Starframe scraper — ${now}`);
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
