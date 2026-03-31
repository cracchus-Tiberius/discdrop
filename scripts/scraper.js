// scripts/scraper.js — DiscDrop price scraper
// Scrapes Norwegian disc golf stores and writes data/scraped-prices.json
// WooCommerce stores: HTML scraping with cheerio
// Shopify stores: public products.json API (no scraping needed)
// Usage: node scripts/scraper.js  or  pnpm scrape

'use strict';

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { isUsedDisc, extractVariant, matchDisc } = require('./stores.config.js');

// ── Store configs ─────────────────────────────────────────────────────────────
const STORES = [
  {
    key: 'wearediscgolf',
    name: 'We Are Disc Golf',
    baseUrl: 'https://wearediscgolf.no',
    freeShippingOver: 899,
    shipping: 45,
    categories: [
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1000',
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1001',
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1002',
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1003',
    ],
    skipCategorySlugs: ['second-hand', 'brukt', 'used', 'nice-not-perfect'],
    selectors: {
      productCard: 'li.product',
      name: 'h2.woocommerce-loop-product__title',
      price: 'span.woocommerce-Price-amount bdi',
      link: 'a.woocommerce-LoopProduct-link',
      outOfStock: '.out-of-stock, .button.disabled',
      outOfStockText: 'utsolgt',
      nextPage: 'a.next.page-numbers',
    },
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

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'no,nb;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** Parse Norwegian price string like "249,00" or "1.249,00" → 249 */
function parseNOKPrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.\s]/g, '').trim();
  const normalised = cleaned.replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
  const n = parseFloat(normalised);
  return isNaN(n) ? null : Math.round(n);
}

// ── Page scraper ──────────────────────────────────────────────────────────────

function scrapeProductsFromHtml(html, store) {
  const $ = cheerio.load(html);
  const sel = store.selectors;
  const products = [];

  $(sel.productCard).each((_, el) => {
    const card = $(el);

    // Skip products in excluded WooCommerce categories (e.g. second-hand)
    if (store.skipCategorySlugs) {
      const cardClass = card.attr('class') || '';
      if (store.skipCategorySlugs.some((slug) => cardClass.includes(`product_cat-${slug}`))) return;
    }

    const nameEl = card.find(sel.name);
    const rawName = nameEl.text().trim();
    if (!rawName) return;

    // Price — grab the first price amount (ignore sale/original price dupe)
    const priceEl = card.find(sel.price).first();
    const rawPrice = priceEl.text().trim();
    const price = parseNOKPrice(rawPrice);
    if (!price) return; // skip if we can't parse a price
    if (price < 50) return; // skip suspiciously low prices (used/clearance)

    // Product URL
    const linkEl = card.find(sel.link).first();
    const href = linkEl.attr('href') || '';
    const productUrl = href.startsWith('http') ? href : store.baseUrl + href;

    // Out of stock detection
    const cardHtml = card.html() || '';
    const cardText = card.text().toLowerCase();
    const hasOutOfStockClass = card.hasClass('out-of-stock') ||
      card.find(sel.outOfStock).length > 0;
    const hasUtsolgt = cardText.includes(sel.outOfStockText);
    const inStock = !hasOutOfStockClass && !hasUtsolgt;

    // Image — first thumbnail in the product card
    const imgEl = card.find('a.woocommerce-LoopProduct-link img').first();
    const image = imgEl.attr('src') || imgEl.attr('data-src') || null;

    if (!isUsedDisc(rawName)) products.push({ rawName, price, productUrl, inStock, image });
  });

  // Next page URL
  const nextPageEl = $(sel.nextPage).first();
  const nextPage = nextPageEl.attr('href') || null;

  return { products, nextPage };
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

      // Skip used/second-hand products by name
      if (isUsedDisc(rawName)) continue;

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

// ── WooCommerce store scraper ─────────────────────────────────────────────────

async function scrapeStore(store) {
  console.log(`\nScraping ${store.name}...`);
  const allProducts = [];
  const seenUrls = new Set();

  for (const categoryUrl of store.categories) {
    let pageUrl = categoryUrl;
    let pageNum = 1;

    while (pageUrl) {
      console.log(`  ${store.key} page ${pageNum}: ${pageUrl}`);
      let html;
      try {
        html = await fetchPage(pageUrl);
      } catch (err) {
        console.warn(`  ⚠ Failed to fetch ${pageUrl}: ${err.message}`);
        break;
      }

      const { products, nextPage } = scrapeProductsFromHtml(html, store);

      for (const p of products) {
        if (!seenUrls.has(p.productUrl)) {
          seenUrls.add(p.productUrl);
          allProducts.push(p);
        }
      }

      await randomDelay();

      if (nextPage && !seenUrls.has(nextPage)) {
        seenUrls.add(nextPage);
        pageUrl = nextPage;
        pageNum++;
      } else {
        break;
      }
    }
  }

  console.log(`  → ${store.name}: found ${allProducts.length} products`);
  return allProducts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`DiscDrop scraper — ${now}`);
  console.log('='.repeat(50));

  const prices = {};      // discId → [storeEntry, ...]
  const unmatched = [];   // { store, rawName, price, url }
  const storeSummary = {};

  const storesMeta = {};
  for (const store of STORES) {
    storesMeta[store.key] = {
      name: store.name,
      url: store.baseUrl,
      freeShippingOver: store.freeShippingOver,
      shipping: store.shipping,
    };
  }

  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const store of STORES) {
    let products;
    try {
      products = store.type === 'shopify'
        ? await scrapeShopifyStore(store)
        : await scrapeStore(store);
    } catch (err) {
      console.error(`  ✗ ${store.name} failed entirely: ${err.message}`);
      storeSummary[store.key] = { found: 0, matched: 0, unmatched: 0, error: err.message };
      continue;
    }

    let matched = 0;
    let notMatched = 0;

    for (const product of products) {
      const disc = matchDisc(product.rawName);
      if (disc) {
        if (!prices[disc.id]) prices[disc.id] = [];
        const variant = extractVariant(product.rawName, disc.brand);
        const existing = prices[disc.id].find((e) => e.store === store.key && e.plastic === variant.plastic);
        if (!existing) {
          prices[disc.id].push({
            store: store.key,
            price: product.price,
            inStock: product.inStock,
            url: product.productUrl,
            image: product.image || null,
            plastic: variant.plastic,
            edition: variant.edition,
            lastScraped: now,
          });
        } else if (product.price < existing.price) {
          existing.price = product.price;
          existing.inStock = product.inStock;
          existing.url = product.productUrl;
          if (product.image && !existing.image) existing.image = product.image;
          existing.lastScraped = now;
        }
        matched++;
        totalMatched++;
      } else {
        unmatched.push({
          store: store.key,
          rawName: product.rawName,
          price: product.price,
          url: product.productUrl,
          inStock: product.inStock,
        });
        notMatched++;
        totalUnmatched++;
      }
    }

    storeSummary[store.key] = {
      found: products.length,
      matched,
      unmatched: notMatched,
    };
  }

  // ── Summary ──
  console.log('\n' + '='.repeat(50));
  console.log('RESULTS:');
  for (const [key, s] of Object.entries(storeSummary)) {
    const meta = storesMeta[key];
    if (s.error) {
      console.log(`  ${meta.name}: ERROR — ${s.error}`);
    } else {
      console.log(`  ${meta.name}: ${s.found} products found, ${s.matched} matched, ${s.unmatched} unmatched`);
    }
  }
  console.log(`\n  Total matched: ${totalMatched}`);
  console.log(`  Total unmatched: ${totalUnmatched}`);
  console.log(`  Discs with scraped prices: ${Object.keys(prices).length}`);

  // ── Write scraped-prices.json ──
  const output = {
    lastUpdated: now,
    stores: storesMeta,
    prices,
  };

  const outPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${outPath}`);

  // ── Write unmatched-products.json ──
  const unmatchedPath = path.join(__dirname, '..', 'data', 'unmatched-products.json');
  fs.writeFileSync(unmatchedPath, JSON.stringify({ lastUpdated: now, products: unmatched }, null, 2));
  console.log(`✓ Wrote ${unmatchedPath} (${unmatched.length} products for review)`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
