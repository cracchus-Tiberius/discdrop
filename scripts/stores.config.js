// scripts/stores.config.js — shared store configs and disc catalog
// Used by standalone per-store scrapers
//
// NOTE: extractVariant and isUsedDisc are exported from THIS file.
// All scrapers must import from './stores.config.js', NOT './plastic-types.js'
'use strict';

const fs = require('fs');
const path = require('path');
const { PLASTIC_TYPES, PLAYER_NAMES, EDITION_KEYWORDS, parseProductName, isUsedDisc, isMiniDisc, isNonDiscProduct } = require('./plastic-types.js');
const { discs: SOURCE_DISCS } = require('../data/discs.js');

// ── Disc catalog (single source of truth: data/discs.js) ────────────────────
const DISC_CATALOG = SOURCE_DISCS.map(({ id, name, brand }) => ({ id, name, brand }));


// ── Store configs ─────────────────────────────────────────────────────────────
// Category slugs that indicate used/second-hand products — applied universally
// In WooCommerce HTML: appears as "product_cat-{slug}" in the <li> class
// In WooCommerce REST API: appears in product.categories[].slug
const SKIP_CATEGORY_SLUGS = ['second-hand', 'brukt', 'used', 'nice-not-perfect'];

// Used keyword check for Shopify product_type / tags fields
function isUsedProductMeta(productType, tags) {
  const haystack = [productType || '', ...(tags || [])].join(' ').toLowerCase();
  return ['second hand', 'second-hand', 'brukt', 'used', 'nice not perfect', 'b-grade'].some((kw) => haystack.includes(kw));
}

const STORE_CONFIGS = {
  golfdiscer: {
    key: 'golfdiscer',
    name: 'GolfDiscer',
    baseUrl: 'https://golfdiscer.no',
    freeShippingOver: 799,
    shipping: 45,
    categoryUrls: [
      'https://golfdiscer.no/product-category/discer/',
    ],
    skipCategorySlugs: SKIP_CATEGORY_SLUGS,
  },
  frisbeesor: {
    key: 'frisbeesor',
    name: 'Frisbee Sør',
    baseUrl: 'https://frisbeesor.no',
    freeShippingOver: 699,
    shipping: 45,
    categoryUrls: [
      'https://frisbeesor.no/product-category/discer/',
    ],
    skipCategorySlugs: SKIP_CATEGORY_SLUGS,
  },
  discexpress: {
    key: 'discexpress',
    name: 'Discexpress',
    url: 'https://www.discexpress.se',
    country: 'SE',
    currency: 'SEK',
    shipping: 41,
    voec: true,
  },
  rocketdiscs: {
    key: 'rocketdiscs',
    name: 'Rocketdiscs',
    url: 'https://rocketdiscs.com',
    country: 'SE',
    currency: 'EUR',
    shipping: 67,
    voec: true,
  },
  discsport: {
    key: 'discsport',
    name: 'Discsport',
    url: 'https://discsport.se',
    country: 'SE',
    currency: 'EUR',
    shipping: 40, // 39 SEK ≈ 40 NOK
    voec: true,
  },
};

// ── Variant extraction (delegates to plastic-types.js) ───────────────────────

/** Extract plastic type and edition from a raw product name */
function extractVariant(rawName, brand) {
  const { plastic, edition } = parseProductName(rawName, brand);
  return { plastic, edition };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Normalise a string for comparison */
function norm(s) {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')        // TeeDevil → Tee Devil
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')   // XCaliber → X Caliber
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NON_DISC_KEYWORDS = [
  'bag', 'sekk', 'ryggsekk', 'basket', 'kurv', 'armbånd', 'handledds',
  'towel', 'håndkle', 'marker', 'kasse',
  // Accessories — added from scrape audit
  'rainfly', 'slim rainfly', 'backpack', 'flashlight', 'stool',
  'flaske', 'klut', 'paraply', 'genser', 'jersey', 'hoodie',
  'gloves', 'warmers', 'patch', 'gavekort', 'startsett', 'zipchip',
  'retriever', 'sound barrier', 'probasket', 'traveler', 'target',
  'led', 'kurvlys', 'disc doctor', 'mikrofiber', 'pins', 'bagtag',
  'chalk bag', 'tripod', 'thro', 'dry bag', 'lens cap',
  'mini metal', 'pvc', 'forcefield', 'frame', 'station',
];

/** Returns false if the product name contains a non-disc keyword */
function isDiscProduct(rawName) {
  const lower = rawName.toLowerCase();
  return !NON_DISC_KEYWORDS.some(kw =>
    new RegExp('(?:^|[\\s,/])' + kw + '(?:[\\s,/]|$)').test(lower)
  );
}

/** Match a raw product name to a disc in the catalog. Longest match wins. */
function matchDisc(rawProductName) {
  if (!isDiscProduct(rawProductName)) return null;

  // Decode common HTML entities for separators (&#8211; = en dash, &#8212; = em dash)
  const decoded = rawProductName
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—');

  // Tour Series suffix retry: many Tour Series listings follow
  //   "[Plastic] [Disc Name] - [Player Name] [Year] [Tour|Team Series]"
  // Only split on space-separator-space (em/en dash or hyphen) to avoid
  // breaking legitimate hyphenated names (Berg-X, Reko-X, P-Line, P4).
  const sepMatch = decoded.match(/^(.+?)\s+[-–—]\s+/);
  const candidates = [decoded];
  if (sepMatch) {
    const prefix = sepMatch[1].trim();
    // Require ≥3 words in prefix to avoid bogus single-word matches
    if (prefix.split(/\s+/).length >= 3) candidates.push(prefix);
  }

  for (const candidate of candidates) {
    const result = matchDiscCandidate(candidate);
    if (result) return result;
  }
  return null;
}

function matchDiscCandidate(rawProductName) {
  // Normalise: lowercase, collapse specials to spaces
  let normalised = norm(rawProductName);
  // Strip year prefix e.g. "2024 Chris Dickerson Tour Series Buzzz"
  normalised = normalised.replace(/^20\d{2}\s+/, '');
  // Insert space before digit suffix to handle "Swan2" → "swan 2", "Aviar3" → "aviar 3"
  normalised = normalised.replace(/([a-z])(\d)/g, '$1 $2');

  let bestMatch = null;
  let bestScore = 0;

  for (const disc of DISC_CATALOG) {
    let discName = norm(disc.name);
    discName = discName.replace(/([a-z])(\d)/g, '$1 $2');
    const pattern = new RegExp(
      '(?:^|\\s)' + discName.replace(/\s+/g, '\\s+') + '(?:\\s|$)',
      'i'
    );
    if (pattern.test(normalised)) {
      // Very short disc names (<= 2 chars) require the brand name to also appear.
      // Exception: Discmania line plastics (C-Line, S-Line, D-Line, P-Line) infer brand.
      if (discName.length <= 2) {
        const brandNorm = norm(disc.brand);
        const brandPattern = new RegExp('(?:^|\\s)' + brandNorm.replace(/\s+/g, '\\s+') + '(?:\\s|$)', 'i');
        const hasDiscmaniaPlastic = disc.brand === 'Discmania' &&
          /\b(?:c[- ]line|s[- ]line|d[- ]line|p[- ]line|q[- ]line)\b/i.test(normalised);
        const hasInnovaPlastic = disc.brand === 'Innova' &&
          /\b(?:champion|star|gstar|blizzard|halo|pro|xt|dx|r-pro|jstar)\b/i.test(normalised);
        if (!hasDiscmaniaPlastic && !hasInnovaPlastic && !brandPattern.test(normalised)) continue;
      }
      const score = discName.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = disc;
      }
    }
  }

  // Log low-confidence matches (disc name is very short relative to product name)
  if (bestMatch) {
    const words = normalised.split(/\s+/).length;
    if (bestScore <= 2 || (bestScore / normalised.length) < 0.2) {
      console.log(`  [low-confidence] "${rawProductName}" → ${bestMatch.id} (nameLen=${bestScore}, productWords=${words})`);
    }
  }

  return bestMatch;
}

// ── Shared merge/write logic ──────────────────────────────────────────────────
// Every per-store scraper was independently reimplementing this (read existing
// scraped-prices.json, drop stale entries for its own store key(s), merge in
// fresh products, write back) — 8 copies that could silently drift apart. One
// shared implementation here instead.
//
// Also the home of `firstSeen` tracking: a NEW price entry gets firstSeen set
// to `now`. An EXISTING entry that predates this field gets it backfilled
// from its own `lastScraped` (a reasonable "we've known about this since at
// least then" lower bound) — backfilling with `now` instead would make the
// entire pre-existing catalog look brand new on rollout day and permanently
// drown out real new drops. Once backfilled/set, firstSeen is never touched
// again for that entry.
//
// products: array of { rawName, price, productUrl, inStock, image, store }
//   — `store` is the specific store key this product belongs to (callers that
//   only ever scrape one store should set it to the same key on every item).
// storeKeys: array of every store key this scraper owns — used to scope which
//   existing entries get cleared before merging in fresh ones.
// storeMeta: { [key]: {...} } written into data.stores as-is (field set is
//   allowed to vary per store — NOK stores use freeShippingOver, international
//   ones use country/currency/voec).
function mergeStoreResults({ products, storeKeys, storeMeta, now }) {
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  let data = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  Object.assign(data.stores, storeMeta);

  const keySet = new Set(storeKeys);

  // The entries below get wiped and rebuilt from scratch every run (that's
  // intentional — everything except firstSeen should reflect this run's
  // fresh scrape). But that means the same-run "existing" lookup a few lines
  // down can never find a prior entry for this store: it was just deleted.
  // Carry firstSeen across the wipe via this lookup instead. Entries from
  // before this field existed get backfilled from their own lastScraped here
  // (once) rather than `now` — `now` would make the whole pre-existing
  // catalog look brand new on rollout day and permanently drown out real new
  // drops.
  const firstSeenByKey = new Map();
  for (const [discId, entries] of Object.entries(data.prices)) {
    for (const e of entries) {
      if (keySet.has(e.store)) {
        firstSeenByKey.set(`${discId}|${e.store}|${e.plastic}`, e.firstSeen || e.lastScraped || now);
      }
    }
  }

  for (const discId of Object.keys(data.prices)) {
    data.prices[discId] = data.prices[discId].filter((e) => !keySet.has(e.store));
    if (data.prices[discId].length === 0) delete data.prices[discId];
  }

  let matched = 0;
  let unmatchedCount = 0;
  const unmatchedProducts = [];

  for (const product of products) {
    const disc = matchDisc(product.rawName);
    if (disc) {
      if (!data.prices[disc.id]) data.prices[disc.id] = [];
      const variant = extractVariant(product.rawName, disc.brand);
      const existing = data.prices[disc.id].find(
        (e) => e.store === product.store && e.plastic === variant.plastic
      );
      if (!existing) {
        const key = `${disc.id}|${product.store}|${variant.plastic}`;
        data.prices[disc.id].push({
          store: product.store,
          price: product.price,
          inStock: product.inStock,
          url: product.productUrl,
          image: product.image || null,
          plastic: variant.plastic,
          edition: variant.edition,
          lastScraped: now,
          firstSeen: firstSeenByKey.get(key) || now,
        });
      } else if (product.price < existing.price) {
        existing.price = product.price;
        existing.inStock = product.inStock;
        existing.url = product.productUrl;
        if (product.image && !existing.image) existing.image = product.image;
        existing.lastScraped = now;
      }
      matched++;
    } else {
      unmatchedProducts.push({
        store: product.store,
        rawName: product.rawName,
        price: product.price,
        url: product.productUrl,
        inStock: product.inStock,
      });
      unmatchedCount++;
    }
  }

  data.lastUpdated = now;
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

  const unmatchedPath = path.join(__dirname, '..', 'data', 'unmatched-products.json');
  let unmatchedData = { lastUpdated: now, products: [] };
  if (fs.existsSync(unmatchedPath)) {
    try {
      unmatchedData = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8'));
      unmatchedData.products = unmatchedData.products.filter((p) => !keySet.has(p.store));
    } catch {}
  }
  unmatchedData.products.push(...unmatchedProducts);
  unmatchedData.lastUpdated = now;
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedData, null, 2));

  return { matched, unmatched: unmatchedCount, total: products.length };
}

module.exports = { DISC_CATALOG, STORE_CONFIGS, SKIP_CATEGORY_SLUGS, norm, matchDisc, isDiscProduct, NON_DISC_KEYWORDS, extractVariant, PLASTIC_TYPES, parseProductName, isUsedDisc, isMiniDisc, isNonDiscProduct, isUsedProductMeta, mergeStoreResults };
