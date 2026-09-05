// scripts/scraper.js — DiscDrop price scraper
// Scrapes Norwegian disc golf stores and writes data/scraped-prices.json
// WooCommerce stores: public wp-json/wc/store/v1/products JSON API
// Shopify stores: public products.json API (no scraping needed)
// Usage: node scripts/scraper.js  or  pnpm scrape

'use strict';

const fetch = require('node-fetch');
const { isUsedDisc, isMiniDisc, isNonDiscProduct, mergeStoreResults } = require('./stores.config.js');

// ── Store configs ─────────────────────────────────────────────────────────────
const STORES = [
  {
    key: 'wearediscgolf',
    name: 'We Are Disc Golf',
    baseUrl: 'https://wearediscgolf.no',
    freeShippingOver: 899,
    shipping: 45,
    type: 'woocommerce-api',
    skipCategorySlugs: ['second-hand', 'brukt', 'used', 'nice-not-perfect'],
  },
  {
    key: 'aceshop',
    name: 'Aceshop',
    baseUrl: 'https://aceshop.no',
    freeShippingOver: 599,
    shipping: 45,
    type: 'woocommerce-api',
    // Aceshop's WAF 403s the shared USER_AGENT above — the Windows
    // Chrome/124.0.0.0 string, which is one of the most common scraper
    // fingerprints there is. Confirmed 2026-09-05: that exact string returns
    // 403 on both the HTML pages and this JSON API, while Chrome/140, the same
    // Chrome/124 on macOS, and this honest UA all return 200 from the same IP.
    // An identifying UA is used rather than a newer Chrome because a spoofed
    // version only stays unblocked until it too ages onto a blocklist.
    userAgent: 'DiscDrop/1.0 (+https://discdrop.net)',
    skipCategorySlugs: ['second-hand', 'brukt', 'used', 'bruktbutikk'],
  },
  // ── Shopify stores (use products.json API) ─────────────────────────────────
  {
    key: 'kvamdgs',
    name: 'Kvam DGS',
    baseUrl: 'https://kvamdgs.no',
    freeShippingOver: 799,
    shipping: 45,
    type: 'shopify',
  },
  {
    key: 'arcticdisc',
    name: 'Arctic Disc',
    baseUrl: 'https://arcticdisc.no',
    freeShippingOver: 1199,
    shipping: 45,
    type: 'shopify',
  },
  {
    key: 'hyzershop',
    name: 'HyzerShop',
    baseUrl: 'https://hyzershop.no',
    freeShippingOver: 749, // confirmed: hyzershop.no/products/wraith listing text "Fri frakt*"
    shipping: 45,
    type: 'shopify',
  },
  {
    key: 'discgolfdynasty',
    name: 'Disc Golf Dynasty',
    baseUrl: 'https://www.discgolfdynasty.no',
    // shipping:45 confirmed live at checkout 2026-08-22 ("Pakke i
    // Postkassen" = 45,00 kr, the cheapest option — matches this file's
    // near-universal default exactly). freeShippingOver still unconfirmed
    // — the checkout basket was too small (139 kr) to reveal a threshold.
    shipping: 45,
    type: 'shopify',
  },
  {
    key: 'discsor',
    name: 'Disc Sør',
    baseUrl: 'https://discsor.no',
    // shipping:60 confirmed live at checkout 2026-08-22 ("Posten Norge" via
    // Vipps MobilePay Checkout = 60,00 kr) — NOT this file's usual 45 kr
    // default, worth calling out since it's the one exception so far.
    // freeShippingOver still unconfirmed — basket was too small (159 kr) to
    // reveal a threshold.
    shipping: 60,
    type: 'woocommerce-api',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// A store can override the User-Agent. Aceshop needs it: its WAF 403s that
// exact spoofed-Chrome string — a very common scraping signature — while a
// current Chrome build, the same version on macOS, or an honest identifying
// UA all pass. See the ACESHOP_USER_AGENT comment on its store entry.
const uaFor = (store) => store.userAgent || USER_AGENT;

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Confirmed in production 2026-08-22: a single network timeout fetching
// page 1 of wearediscgolf's WooCommerce API killed the whole store's run
// for the day — 0 products found, correctly refused by mergeStoreResults'
// >50%-drop guard rather than writing garbage, but still left 2 days of
// stale data with no retry ever attempted. Frisbeebutikken and Starframe
// (a different platform entirely) timed out the same way in the same
// ~10-minute window that same run — a transient runner/network blip, not
// a site-side break. Shared by both the Shopify and WooCommerce fetchers
// below so neither has its own copy to drift out of sync.
async function fetchJsonWithRetry(url, options, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt < attempts) {
        console.warn(`  ⚠ Attempt ${attempt}/${attempts} failed to fetch ${url}: ${err.message} — retrying in 5s`);
        await sleep(5000);
      } else {
        console.warn(`  ⚠ Failed to fetch ${url} after ${attempts} attempts: ${err.message}`);
      }
    }
  }
  return null;
}

function randomDelay() {
  const ms = 2000 + Math.random() * 1000;
  return sleep(ms);
}

// ── Shopify scraper ───────────────────────────────────────────────────────────

async function scrapeShopifyStore(store) {
  console.log(`\nScraping ${store.name} (Shopify API)...`);
  const allProducts = [];
  let page = 1;

  while (true) {
    const url = `${store.baseUrl}/products.json?limit=250&page=${page}`;
    console.log(`  ${store.key} page ${page}: ${url}`);

    const data = await fetchJsonWithRetry(url, {
      headers: { 'User-Agent': uaFor(store), 'Accept': 'application/json' },
      timeout: 15000,
    });
    if (data === null) break;

    const products = data.products || [];
    if (products.length === 0) break;

    for (const product of products) {
      const rawName = product.title;
      if (!rawName) continue;

      // Skip used/second-hand and mini marker products
      if (isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;

      // Also check product_type and tags for used/second-hand indicators
      const typeAndTags = [product.product_type || '', ...(product.tags || [])].join(' ').toLowerCase();
      if (['second hand', 'second-hand', 'brukt', 'used', 'nice not perfect', 'b-grade'].some((kw) => typeAndTags.includes(kw))) continue;

      const variants = product.variants || [];
      if (variants.length === 0) continue;

      // Use cheapest available variant; fall back to cheapest overall
      const availableVariants = variants.filter((v) => v.available);
      const pool = availableVariants.length ? availableVariants : variants;
      const prices = pool
        .map((v) => parseFloat(v.price))
        .filter((p) => !isNaN(p) && p > 0);
      if (prices.length === 0) continue;

      const price = Math.round(Math.min(...prices));
      if (price < 50) continue; // skip suspiciously low prices (used/clearance)
      const inStock = availableVariants.length > 0;
      const productUrl = `${store.baseUrl}/products/${product.handle}`;

      const image = (product.images && product.images[0]) ? product.images[0].src : null;
      allProducts.push({ rawName, price, productUrl, inStock, image });
    }

    await randomDelay();
    page++;
  }

  console.log(`  → ${store.name}: found ${allProducts.length} products`);
  return allProducts;
}

// ── WooCommerce Store API scraper ─────────────────────────────────────────────
// Uses the site's public wp-json/wc/store/v1/products JSON API instead of
// scraping rendered HTML. Same public data WooCommerce serves to its own
// storefront JS, but structured and paginated at 100/page instead of the
// theme's 8-per-page HTML listing (2500 products at 8/page = 313 HTML pages,
// which is what was blowing the 10-min timeout every day).
// Stops on the first page that returns fewer than PER_PAGE items — X-WP-Total
// is unreliable on this site, so we don't trust it for loop termination.

const WC_API_PER_PAGE = 100;
const WC_API_MAX_PAGES = 60; // safety net: 60 * 100 = 6000 products, well above any real catalog

async function scrapeWooCommerceApiStore(store) {
  console.log(`\nScraping ${store.name} (WooCommerce Store API)...`);
  const allProducts = [];
  let page = 1;

  while (page <= WC_API_MAX_PAGES) {
    // orderby=id&order=asc gives a stable sort — the default "latest" sort
    // reshuffles as the catalog changes mid-crawl, which was silently
    // skipping/duplicating products across the ~25 pages of a single run.
    const url = `${store.baseUrl}/wp-json/wc/store/v1/products?per_page=${WC_API_PER_PAGE}&page=${page}&orderby=id&order=asc`;
    console.log(`  ${store.key} page ${page}: ${url}`);

    // Confirmed in production 2026-08-22 (and reproduced directly):
    // per_page=100 with orderby=id&order=asc genuinely takes 12-26s on
    // wearediscgolf's backend — not a network fluke, this store's WooCommerce
    // install is just slow to serve a sorted 100-item page. The 15s timeout
    // that was fine for every other store here was too tight for this one
    // specifically, killing the whole store's daily run on ~every slow
    // response. 40s comfortably covers the slowest observed response with
    // margin, and fetchJsonWithRetry above still retries beyond that.
    const data = await fetchJsonWithRetry(url, {
      headers: { 'User-Agent': uaFor(store), 'Accept': 'application/json' },
      timeout: 40000,
    });
    if (!Array.isArray(data) || data.length === 0) break;

    for (const product of data) {
      const rawName = product.name;
      if (!rawName) continue;

      // Skip used/second-hand categories (belt-and-braces alongside the
      // name-based isUsedDisc check below, which also catches most of these)
      const categorySlugs = (product.categories || []).map((c) => c.slug);
      if (store.skipCategorySlugs && store.skipCategorySlugs.some((slug) => categorySlugs.includes(slug))) continue;

      if (isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;

      const rawPrice = product.prices && product.prices.price;
      const price = rawPrice ? Math.round(parseInt(rawPrice, 10) / (10 ** (product.prices.currency_minor_unit ?? 2))) : null;
      if (!price || price < 50) continue; // skip unparseable or suspiciously low (used/clearance) prices

      const productUrl = product.permalink || `${store.baseUrl}/produkt/${product.slug}`;
      const inStock = product.is_in_stock !== false;
      const image = (product.images && product.images[0]) ? product.images[0].src : null;

      allProducts.push({ rawName, price, productUrl, inStock, image });
    }

    await randomDelay();
    page++;
  }

  console.log(`  → ${store.name}: found ${allProducts.length} products`);
  return allProducts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`DiscDrop scraper — ${now}`);
  console.log('='.repeat(50));

  const storeSummary = {};
  let totalMatched = 0;
  let totalUnmatched = 0;
  let totalDiscsWithPrices = 0;

  for (const store of STORES) {
    // Everything for this store — scrape AND merge — lives in one try/catch.
    // mergeStoreResults() used to sit outside this block: when its >50%
    // drop-guard (scripts/stores.config.js) threw for one store, the error
    // was uncaught, main().catch() below killed the whole process, and
    // every store after the failing one in STORES silently never ran —
    // confirmed in production: wearediscgolf's guard tripping left kvamdgs
    // and arcticdisc (both healthy) stuck on 2-day-old data too, since
    // they're later in this same array.
    try {
      const products = store.type === 'shopify'
        ? await scrapeShopifyStore(store)
        : await scrapeWooCommerceApiStore(store);

      const taggedProducts = products.map((p) => ({ ...p, store: store.key }));
      const result = mergeStoreResults({
        products: taggedProducts,
        storeKeys: [store.key],
        storeMeta: {
          [store.key]: {
            name: store.name,
            url: store.baseUrl,
            freeShippingOver: store.freeShippingOver,
            shipping: store.shipping,
          },
        },
        now,
      });

      storeSummary[store.key] = { name: store.name, found: products.length, matched: result.matched, unmatched: result.unmatched };
      totalMatched += result.matched;
      totalUnmatched += result.unmatched;
    } catch (err) {
      console.error(`  ✗ ${store.name} failed entirely: ${err.message}`);
      storeSummary[store.key] = { name: store.name, found: 0, matched: 0, unmatched: 0, error: err.message };
      continue;
    }
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(50));
  console.log('RESULTS:');
  for (const s of Object.values(storeSummary)) {
    if (s.error) {
      console.log(`  ${s.name}: ERROR — ${s.error}`);
    } else {
      console.log(`  ${s.name}: ${s.found} products found, ${s.matched} matched, ${s.unmatched} unmatched`);
    }
  }
  console.log(`\n  Total matched: ${totalMatched}`);
  console.log(`  Total unmatched: ${totalUnmatched}`);

  // Confirmed in production 2026-08-22: wearediscgolf hit a network timeout
  // and its per-store catch block above logged the error and moved on —
  // main() still resolved normally, so this whole process exited 0.
  // scripts/scrape-all.js only tracks pass/fail by exit code per step, so
  // "WeAreDiscGolf / Kvam / Arctic" was reported as a fully successful step
  // even though wearediscgolf's data was silently 2 days stale — nothing
  // in the daily summary ever surfaced it. kvamdgs/arcticdisc's already-
  // merged data is untouched by this (mergeStoreResults already wrote it
  // per-store above); this only makes the PROCESS exit code reflect that
  // at least one store in this run actually failed.
  const failedStores = Object.values(storeSummary).filter((s) => s.error);
  if (failedStores.length > 0) {
    console.error(`\n  ${failedStores.length} store(s) failed: ${failedStores.map((s) => s.name).join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
