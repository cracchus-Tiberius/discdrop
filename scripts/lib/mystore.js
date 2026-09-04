'use strict';

// scripts/lib/mystore.js — the shared Mystore scraper.
//
// Mystore is a Norwegian e-commerce platform with no public product API, so
// every store on it has to be read out of listing HTML. Frisbeebutikken and
// Starframe each carried a near-verbatim copy of that logic, with their own
// files' comments telling the next person to "keep both in sync if the Mystore
// markup ever changes" — an instruction that only works for as long as someone
// remembers to follow it. Adding Krokhol would have made three copies, so the
// logic lives here once and each store is a config object.
//
// Two card renderings exist in the wild, and a store serves one or the other:
//
//   1. Alpine.js handler. Each card's add-to-cart button carries
//        @click.prevent="async () => { ... await $store.cart.addToCart({
//            name: 'Champion Caiman', image: 'https://...', price: '219,-',
//            url: 'https://.../products/champion-caiman', brand: 'Innova' }) }"
//      a JS object literal (unquoted keys, single-quoted strings), not JSON, so
//      it is pulled apart with regex. Frisbeebutikken and Starframe serve this.
//
//   2. Server-rendered card markup, no addToCart anywhere on the page. Krokhol
//      serves this. See parseServerRenderedCards() for the shape.
//
// parseListing() tries the handler form first and falls back to card markup, so
// a store that changes theme keeps working, and neither store needs to declare
// which rendering it has.

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('../stores.config.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randomDelay = (min = 2000, max = 5000) => sleep(min + Math.random() * (max - min));

// Suspiciously low prices are used/clearance listings or a parse error, never a
// real new disc. Same threshold the rest of the pipeline uses.
const MIN_PRICE_NOK = 50;

// Default pagination link selector. "?page=" alone does NOT match "?&page=2" —
// substring test, and that string contains "?&page=", not "?page=" — so stores
// on the ?&page= shape need both alternatives present.
const DEFAULT_PAGINATION_SELECTOR = 'a[href*="?&page="], a[href*="?page="]';

/**
 * Norwegian price text to whole NOK. Handles Mystore's "189,-", the "1 025,-"
 * thousands form, and "219,00".
 *
 * Deliberately not a bare replace(/[^\d]/g,''), which both store scrapers used
 * before this was extracted: that turns "219,00" into 21900. Neither of those
 * two stores serves the decimal form so it never bit them, but a shared parser
 * cannot assume the next store's theme is as convenient.
 */
function parseNok(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  const dec = s.match(/(\d[\d\s.]*),(\d{2})\s*$/);
  if (dec) {
    const whole = dec[1].replace(/[^\d]/g, '');
    return whole ? Math.round(parseInt(whole, 10) + parseInt(dec[2], 10) / 100) : null;
  }
  const digits = s.replace(/[^\d]/g, '');
  return digits ? parseInt(digits, 10) : null;
}

function isSellableDisc(rawName) {
  return Boolean(rawName) && !isUsedDisc(rawName) && !isMiniDisc(rawName) && !isNonDiscProduct(rawName);
}

/** Rendering 1: product data inside each card's addToCart({...}) handler. */
function parseAddToCartCards(html) {
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

    const price = parseNok(priceM[1]);
    if (!price || isNaN(price) || price < MIN_PRICE_NOK) continue;

    if (!isSellableDisc(rawName)) continue;
    products.push({ rawName, price, productUrl: urlM[1], inStock: true, image: imageM ? imageM[1] : null });
  }

  return products;
}

/**
 * Rendering 2: server-rendered cards. Krokhol's theme emits, per product:
 *
 *   <div class="button_is_buy_now_button product-box cards"
 *        data-price-including-tax="209"            <- regular price
 *        data-special-price-including-tax="189">   <- sale price, when on sale
 *     <div class="product" data-quantity="14" data-manufacturer="Discraft">
 *       <a href="https://.../products/..." class="__product_url">
 *       <a class="title col-md-12">ESP Zeus - Paul McBeth</a>
 *       <div class="price has-special-price">
 *         <s>209,-</s><span class="special">189,-</span>
 *
 * Two things this has to get right. The visible title carries the PLASTIC but
 * not the BRAND ("Star Destroyer", not "Innova Star Destroyer") — the brand
 * lives in data-manufacturer, and matchDisc needs it, since short and ambiguous
 * mold names are brand-gated on purpose. And a sale renders as a struck-through
 * former price plus a .special current price; the current price is the one to
 * take.
 */
function parseServerRenderedCards(html, { baseUrl } = {}) {
  const $ = cheerio.load(html);
  const abs = (href) => { try { return new URL(href, baseUrl).toString(); } catch { return null; } };
  const products = [];

  $('.product-box.cards').each((_, el) => {
    const $card = $(el);
    const $inner = $card.find('.product').first();

    const title = $card.find('.product_box_title_row a.title').first().text().trim();
    if (!title) return;

    // Prefix the brand only when the title does not already lead with it —
    // "Kastaplast K3 Reko" must not become "Kastaplast Kastaplast K3 Reko".
    const brand = ($inner.attr('data-manufacturer') || '').trim();
    const rawName = brand && !title.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${title}`
      : title;
    if (!isSellableDisc(rawName)) return;

    const href = $card.find('a.__product_url').first().attr('href')
      || $card.find('.product_box_title_row a.title').first().attr('href');
    const productUrl = href ? abs(href) : null;
    if (!productUrl) return;

    // Visible price: the .special span when on sale, otherwise the .price text
    // with any struck-through former price removed.
    const $price = $card.find('.price').first();
    const $special = $price.find('.special').first();
    const price = parseNok($special.length ? $special.text() : $price.clone().children('s').remove().end().text());
    if (!price || isNaN(price) || price < MIN_PRICE_NOK) return;

    // data-quantity on the inner .product is Mystore's stock count. A missing
    // attribute means in stock rather than dropping the product — these
    // listings only render for purchasable items.
    const qty = ($inner.attr('data-quantity') || '').trim();
    const inStock = qty === '' ? true : parseInt(qty, 10) > 0;

    const image = $card.find('a.__product_url img').first().attr('src') || null;
    products.push({ rawName, price, productUrl, inStock, image });
  });

  return products;
}

/** Products plus the highest page number the listing links to. */
function parseListing(html, store) {
  let products = parseAddToCartCards(html);
  if (products.length === 0) products = parseServerRenderedCards(html, store);

  const $ = cheerio.load(html);
  let maxPage = 1;
  $(store.paginationSelector || DEFAULT_PAGINATION_SELECTOR).each((_, el) => {
    const m = ($(el).attr('href') || '').match(/[?&]page=(\d+)/);
    if (m) maxPage = Math.max(maxPage, parseInt(m[1], 10));
  });

  return { products, maxPage };
}

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
// run — both platform-side attempts failing together in one ~10-minute window
// (Frisbeebutikken and Starframe on this platform, plus wearediscgolf on an
// unrelated one) points at a transient runner/network blip, not a site break.
// 2 retries with a short backoff here costs seconds and can avoid needing the
// much heavier Playwright fallback at all.
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

// ── Attempt 1: enhanced fetch headers ────────────────────────────────────────

async function scrapeWithHeaders(store) {
  console.log('  Attempt 1: enhanced fetch headers');
  const allProducts = [];
  const seenUrls = new Set();

  const firstUrl = store.pageUrl(1);
  console.log(`    ${store.key} p1: ${firstUrl}`);

  let html;
  try {
    html = await fetchPage(firstUrl, 'https://www.google.no/');
  } catch (err) {
    console.warn(`    ⚠ ${err.message}`);
    return null;
  }

  let { products: firstProducts, maxPage } = parseListing(html, store);

  if (isChallengePage(html, firstProducts.length)) {
    console.log('    ✗ Bot protection detected — switching to Playwright');
    return null;
  }

  // Confirmed in production 2026-08-18 (Frisbeebutikken): page 1 loaded fine
  // (98 real products parsed correctly) but maxPage came back as 1 on a
  // catalogue that actually has 4 pages — the pagination links were there on a
  // request made minutes later, so this reads as a one-off truncated/incomplete
  // response rather than a real site change. Re-fetching page 1 once whenever
  // maxPage looks like "no pagination" catches that transient case before it
  // gets treated as "this is the whole catalog" and silently trips the >50%
  // drop guard in mergeStoreResults.
  if (maxPage === 1) {
    await randomDelay(1000, 2000);
    let retryHtml;
    try {
      retryHtml = await fetchPage(firstUrl, 'https://www.google.no/');
    } catch {
      retryHtml = null;
    }
    if (retryHtml) {
      const retry = parseListing(retryHtml, store);
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

  // A mid-pagination HTTP error or an unexpectedly empty page (before we've
  // reached the maxPage that page 1 itself reported) used to just `break` —
  // that silently accepted whatever partial result had been collected AS IF it
  // were the complete catalog, and the caller had no way to tell "found
  // everything" apart from "gave up early". Rate limiting kicking in partway
  // through pagination looked identical to reaching the last page, and
  // isChallengePage() was only ever checked on page 1, so bot protection
  // triggered by page 3 went undetected entirely. Any page that errors, comes
  // back empty before maxPage, or trips the challenge check now aborts attempt
  // 1 and falls back to Playwright.
  for (let page = 2; page <= maxPage; page++) {
    await randomDelay(2000, 3000);
    const url = store.pageUrl(page);
    console.log(`    ${store.key} p${page}: ${url}`);

    try {
      html = await fetchPage(url, store.categoryUrl);
    } catch (err) {
      console.warn(`    ⚠ Page ${page}/${maxPage} failed (${allProducts.length} products collected so far): ${err.message}`);
      return null;
    }

    const { products } = parseListing(html, store);

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

// ── Attempt 2: Playwright headless browser ───────────────────────────────────

const NATURAL_SCROLL = async () => {
  await new Promise((resolve) => {
    const step = () => {
      window.scrollBy(0, 120 + Math.floor(Math.random() * 60));
      if (window.scrollY < document.body.scrollHeight * 0.9) {
        setTimeout(step, 80 + Math.floor(Math.random() * 60));
      } else { resolve(); }
    };
    setTimeout(step, 200);
  });
};

async function scrapeWithPlaywright(store) {
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
  const paginationSelector = store.paginationSelector || DEFAULT_PAGINATION_SELECTOR;

  try {
    // Just a "look like a real visitor" warm-up before the category page — not
    // itself a data source, so a timeout here (confirmed in production
    // 2026-08-22, same run as fetchPage's retries above) shouldn't abort the
    // whole attempt when the category page load right after it might succeed.
    try {
      console.log(`    Visiting ${store.baseUrl}...`);
      await page.goto(store.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await randomDelay(2000, 3000);
    } catch (err) {
      console.warn(`    ⚠ Warm-up visit to ${store.baseUrl} failed (${err.message}) — continuing to category page anyway`);
    }

    await page.goto(store.pageUrl(1), { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(NATURAL_SCROLL);
    await sleep(1000);

    const maxPage = await page.evaluate((selector) => {
      let max = 1;
      document.querySelectorAll(selector).forEach((a) => {
        const m = (a.href || '').match(/[?&]page=(\d+)/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      });
      return max;
    }, paginationSelector);

    for (let p = 1; p <= maxPage; p++) {
      if (p > 1) {
        await randomDelay(2000, 4000);
        await page.goto(store.pageUrl(p), { waitUntil: 'networkidle', timeout: 30000 });
        await page.evaluate(NATURAL_SCROLL);
        await sleep(1000);
      }

      const { products } = parseListing(await page.content(), store);

      for (const prod of products) {
        if (!seenUrls.has(prod.productUrl)) {
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

// ── Entry point ──────────────────────────────────────────────────────────────

/**
 * store: {
 *   key, name, baseUrl, categoryUrl,
 *   shipping, freeShippingOver?,   // omitted when the store publishes none
 *   pageUrl(page),                 // page 1 is usually the bare category URL
 *   paginationSelector?,           // defaults to both ?page= and ?&page= shapes
 * }
 */
async function runMystoreScrape(store) {
  const now = new Date().toISOString();
  console.log(`${store.name} scraper — ${now}`);
  console.log('='.repeat(50));

  let products = await scrapeWithHeaders(store);
  if (!products) products = await scrapeWithPlaywright(store);

  // Key order matches what the per-store scrapers wrote before this was
  // extracted, so scraped-prices.json's stores block does not churn.
  const meta = { name: store.name, url: store.baseUrl };
  if (store.freeShippingOver != null) meta.freeShippingOver = store.freeShippingOver;
  meta.shipping = store.shipping;

  const result = mergeStoreResults({
    products: products.map((p) => ({ ...p, store: store.key })),
    storeKeys: [store.key],
    storeMeta: { [store.key]: meta },
    now,
  });
  console.log(`  Matched ${result.matched} discs, ${result.unmatched} unmatched`);
  return result;
}

/** Wires a store config up as a runnable script with the standard error exit. */
function runAsScript(store) {
  runMystoreScrape(store).catch((err) => {
    console.error('\nFatal:', err.message);
    process.exit(1);
  });
}

module.exports = {
  parseNok,
  parseAddToCartCards,
  parseServerRenderedCards,
  parseListing,
  isChallengePage,
  runMystoreScrape,
  runAsScript,
  DEFAULT_PAGINATION_SELECTOR,
  MIN_PRICE_NOK,
};
