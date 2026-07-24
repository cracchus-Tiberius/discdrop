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
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
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

    let data;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        timeout: 15000,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.warn(`  ⚠ Failed to fetch ${url}: ${err.message}`);
      break;
    }

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

    let data;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
        timeout: 15000,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.warn(`  ⚠ Failed to fetch ${url}: ${err.message}`);
      break;
    }

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
    let products;
    try {
      products = store.type === 'shopify'
        ? await scrapeShopifyStore(store)
        : await scrapeWooCommerceApiStore(store);
    } catch (err) {
      console.error(`  ✗ ${store.name} failed entirely: ${err.message}`);
      storeSummary[store.key] = { name: store.name, found: 0, matched: 0, unmatched: 0, error: err.message };
      continue;
    }

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
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
