// scripts/stores.config.js — shared store configs and disc catalog
// Used by standalone per-store scrapers
//
// NOTE: extractVariant and isUsedDisc are exported from THIS file.
// All scrapers must import from './stores.config.js', NOT './plastic-types.js'
'use strict';

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
  'towel', 'håndkle', 'marker', 'kasse', 'mold',
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

module.exports = { DISC_CATALOG, STORE_CONFIGS, SKIP_CATEGORY_SLUGS, norm, matchDisc, isDiscProduct, NON_DISC_KEYWORDS, extractVariant, PLASTIC_TYPES, parseProductName, isUsedDisc, isMiniDisc, isNonDiscProduct, isUsedProductMeta };
