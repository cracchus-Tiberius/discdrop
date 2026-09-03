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
const SKIP_CATEGORY_SLUGS = ['second-hand', 'brukt', 'used', 'nice-not-perfect', 'begagnad', 'begagnade'];

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
  nydisk: {
    key: 'nydisk',
    name: 'NyDisk',
    baseUrl: 'https://nydisk.no',
    freeShippingOver: 800,
    shipping: 45,
  },
  discshopen: {
    key: 'discshopen',
    name: 'DiscShopen',
    baseUrl: 'https://discshopen.no',
    freeShippingOver: 699,
    shipping: 45,
    playwrightCategoryUrls: ['https://discshopen.no/butikk/'],
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
  ugglans: {
    key: 'ugglans',
    name: 'Ugglans Discgolf',
    url: 'https://ugglansdiscgolf.se',
    freeShippingOver: 800,
    shipping: 45,
    country: 'SE',
    currency: 'SEK',
    voec: true,
  },
  discace: {
    key: 'discace',
    name: 'Discace of Sweden',
    url: 'https://discaceofsweden.com',
    freeShippingOver: 700,
    shipping: 29,
    country: 'SE',
    currency: 'SEK',
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

/** True if any of `brand`'s known plastic-line keywords (from PLASTIC_TYPES)
 * appear in `normalisedText` — used to infer brand for short disc names (see
 * matchDiscCandidate) without requiring the brand name itself to be present.
 * Covers any brand with a PLASTIC_TYPES entry (MVP, Axiom, Streamline, RPM
 * Discs, Prodigy, ...); Discmania/Innova have their own hand-tuned regex
 * below and don't need this. */
function brandPlasticPresent(brand, normalisedText) {
  const entry = PLASTIC_TYPES[brand];
  if (!entry) return false;
  for (const w of [...(entry.prefix || []), ...(entry.suffix || [])]) {
    const wn = norm(w);
    if (wn && new RegExp('(?:^|\\s)' + wn.replace(/\s+/g, '\\s+') + '(?:\\s|$)', 'i').test(normalisedText)) {
      return true;
    }
  }
  return false;
}

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

/** Same as norm(), but WITHOUT inserting a space at camelCase boundaries.
 * norm()'s camelCase split assumes "TeeBird" is really "Tee Devil"-style two
 * words that lost their space — correct for some catalog names, but wrong
 * whenever the catalog's canonical name is genuinely one word (e.g.
 * "Teebird"): "TeeBird" then splits into "tee bird", which never matches the
 * catalog's single-token "teebird". Rocketdiscs in particular writes disc
 * names this way ("DX TeeBird", "GStar TeeBird"). Used as a second match
 * attempt alongside norm() rather than a replacement, since the split *is*
 * correct for real two-word names typed without a space. */
function normNoCamelSplit(s) {
  return s
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
  // "Sigr" backpack brand — confirmed false-matching to viking-odin via a
  // "Sigr Odin" backpack product (kvamdgs.no), not a disc at all.
  'sigr', 'väska', 'ryggsäck',
  // Swedish candy/snack keywords — confirmed false-matching to clash-salt via
  // "Ferarri: Salt Hallon" (product_type "Godis"/candy) on discexpress.se,
  // since Clash Discs' real "Salt" mold and its "Salt" plastic-blend name are
  // themselves too generic to disambiguate from a snack product.
  'hallon', 'godis', 'lakrits', 'tuggummi', 'kola',
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

  // Second candidate string without the camelCase split — see normNoCamelSplit.
  let normalisedNoSplit = normNoCamelSplit(rawProductName);
  normalisedNoSplit = normalisedNoSplit.replace(/^20\d{2}\s+/, '');
  normalisedNoSplit = normalisedNoSplit.replace(/([a-z])(\d)/g, '$1 $2');

  // Separator-insensitive index of the product title: every 1-3 word window,
  // joined with its spaces and hyphens removed. Lets a catalog name written as
  // one word match a store that writes it as two ("Cloudbreaker" vs Discmania's
  // own "Cloud Breaker", 55 live listings across the store network) without
  // resorting to a bare substring test on a space-stripped title — that test
  // reports "wasp" inside "glow aspect", "nova" inside "innova", "fire" inside
  // "hellfire" and "spark" inside "sparkle". Windows preserve word boundaries,
  // so only a real name-shaped run of words can match. See CLAUDE.md's
  // "Matcher-regler".
  const sepFreeWindows = new Set();
  for (const text of normalisedNoSplit !== normalised ? [normalised, normalisedNoSplit] : [normalised]) {
    const words = text.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      for (let j = i + 1; j <= Math.min(i + 3, words.length); j++) {
        sepFreeWindows.add(words.slice(i, j).join(''));
      }
    }
  }
  // Guarded to names of 5+ characters. Shorter ones are exactly where joining
  // adjacent words starts producing accidents, and they are already the case
  // the brand check below exists for.
  const MIN_SEP_FREE_LEN = 5;

  let bestMatch = null;
  let bestScore = 0;

  for (const disc of DISC_CATALOG) {
    let discName = norm(disc.name);
    discName = discName.replace(/([a-z])(\d)/g, '$1 $2');
    const pattern = new RegExp(
      '(?:^|\\s)' + discName.replace(/\s+/g, '\\s+') + '(?:\\s|$)',
      'i'
    );
    const discNameSepFree = discName.replace(/\s+/g, '');
    const sepFreeHit = discNameSepFree.length >= MIN_SEP_FREE_LEN && sepFreeWindows.has(discNameSepFree);
    if (pattern.test(normalised) || (normalisedNoSplit !== normalised && pattern.test(normalisedNoSplit)) || sepFreeHit) {
      // Very short disc names (<= 3 chars, e.g. "Spy", "H1", "P2") require the
      // brand name to also appear — otherwise a short, generic-looking name
      // can match a completely unrelated product from a different brand that
      // merely happens to contain the same word (confirmed in production:
      // "Northstar Spy" was matching catalog id prodiscus-spy).
      // Exception: Discmania/Innova plastic-line keywords infer brand, since
      // those are near-universally present whenever the short name is.
      //
      // Some longer disc names double as tour-series/signature/fan-art stamp
      // themes stores print AFTER the real mold name — e.g. "Neutron Hex
      // Viking Berserker" (an Axiom Hex with fan-art) matched catalog id
      // viking-berserker, and "Discmania Neo PD Phenom Stone 1" matched
      // dynamic-phenom (Legacy Discs' actual mold) — because "longest match
      // wins" let the stamp name beat the real (shorter) mold name earlier
      // in the same title. Require brand confirmation for these too.
      //
      // "motion" and "flow" are also generic enough words to collide with
      // unrelated products — confirmed in production: WeAreDiscGolf's
      // "Arctic Line Putter Flow Motion" (a 99 kr non-MVP, non-Latitude 64
      // product — "Arctic Line" is their own in-house plastic naming for a
      // putter, not a mold) matched catalog id mvp-motion via "motion"
      // (longest match wins), dragging its "best price" down to a fake
      // ~34% "prisfall". Once "motion" alone was brand-checked, the SAME
      // bad product just fell through to "flow" instead and corrupted
      // latitude-flow (a fairway driver) the same way — both need the
      // check together, not just one. Safe to add: every legitimate
      // listing for either mold already carries a real brand plastic
      // keyword (MVP: Neutron/Plasma/R2 Neutron; Latitude 64: Opto — see
      // the prefix lists above), which satisfies hasOtherBrandPlastic below
      // on its own, without needing the literal brand name in the title.
      //
      // "dragon" and "function" — confirmed in production 2026-08-22 via
      // Prisfall drop review: Disc Golf Dynasty's "Yikun Dragon Da'E" (own
      // page title says Yikun, a Chinese third-party mold maker per
      // docs/DiscDrop_Knowledge_Base.md, not Innova) matched innova-dragon,
      // and Starframe's "GEO Function" (own JSON-LD brand.name: "Discmania")
      // matched latitude-function. Both are generic enough mold names to
      // collide the same way as motion/flow above.
      const REQUIRES_BRAND_CHECK = new Set(['berserker', 'phenom', 'viking', 'motion', 'flow', 'dragon', 'function']);
      if (discName.length <= 3 || REQUIRES_BRAND_CHECK.has(discName)) {
        const brandNorm = norm(disc.brand);
        const brandPattern = new RegExp('(?:^|\\s)' + brandNorm.replace(/\s+/g, '\\s+') + '(?:\\s|$)', 'i');
        const discmaniaPlasticRe = /\b(?:c[- ]line|s[- ]line|d[- ]line|p[- ]line|q[- ]line)\b/i;
        const innovaPlasticRe = /\b(?:champion|star|gstar|blizzard|halo|pro|xt|dx|r-pro|jstar)\b/i;
        const texts = normalisedNoSplit !== normalised ? [normalised, normalisedNoSplit] : [normalised];
        const hasDiscmaniaPlastic = disc.brand === 'Discmania' && texts.some((t) => discmaniaPlasticRe.test(t));
        const hasInnovaPlastic = disc.brand === 'Innova' && texts.some((t) => innovaPlasticRe.test(t));
        const hasOtherBrandPlastic = disc.brand !== 'Discmania' && disc.brand !== 'Innova' &&
          texts.some((t) => brandPlasticPresent(disc.brand, t));
        if (!hasDiscmaniaPlastic && !hasInnovaPlastic && !hasOtherBrandPlastic && !texts.some((t) => brandPattern.test(t))) continue;
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
// Drop-guard thresholds — same philosophy as scrape-discexpress.js's currency
// assertion: a scraper finding drastically fewer products than last run is
// far more likely a broken scraper (pagination bug, new bot protection, a
// site rebuild) than a real overnight inventory collapse. Below
// MIN_BASELINE_FOR_DROP_GUARD a store hasn't scraped enough previously for a
// ratio comparison to mean anything (a brand-new store's first real run, or
// one that's always been tiny), so the guard is skipped for it.
const DROP_GUARD_RATIO = 0.5;
const MIN_BASELINE_FOR_DROP_GUARD = 20;

// firstSeenByKey below is keyed by discId, so a catalog id RENAME (split or
// otherwise) makes every one of that disc's listings look brand new on the
// next scrape — same store, same plastic, but a key the old data never had.
// That's not just cosmetic: new-in-stores.js treats a fresh firstSeen as
// "just arrived" and would flag these as new-disc/new-at-store even though
// they're long-standing market discs, not new arrivals. Map new id -> old
// id here for any rename where that matters (i.e. one that happens while
// the new-in-stores pipeline is live) so the firstSeen lookup falls back to
// the old key instead of resetting. discmania-active (2026-09-02): a
// catch-all keyed on the "Active" plastic line, split into its 10 real
// molds — see data/discs.js's comment above the discmania-active removal.
const FIRST_SEEN_ID_ALIASES = {
  // latitude-function -> discmania-function (2026-09-03): the id said
  // Latitude 64, but all 10 of its store listings were Discmania Neo
  // Function. See data/discs.js's comment on the entry.
  'discmania-function': 'latitude-function',
  'discmania-maestro': 'discmania-active',
  'discmania-rockstar': 'discmania-active',
  'discmania-mentor': 'discmania-active',
  'discmania-magician': 'discmania-active',
  'discmania-genius': 'discmania-active',
  'discmania-astronaut': 'discmania-active',
  'discmania-sensei': 'discmania-active',
  'discmania-majesty': 'discmania-active',
  'discmania-shogun': 'discmania-active',
  'discmania-mermaid': 'discmania-active',
};

function countEntriesForKeys(prices, keySet) {
  let count = 0;
  for (const entries of Object.values(prices)) {
    for (const e of entries) {
      if (keySet.has(e.store)) count++;
    }
  }
  return count;
}

function mergeStoreResults({ products, storeKeys, storeMeta, now }) {
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  let data = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  Object.assign(data.stores, storeMeta);

  const keySet = new Set(storeKeys);
  const previousEntryCount = countEntriesForKeys(data.prices, keySet);

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
        const aliasId = FIRST_SEEN_ID_ALIASES[disc.id];
        const aliasKey = aliasId ? `${aliasId}|${product.store}|${variant.plastic}` : null;
        data.prices[disc.id].push({
          store: product.store,
          price: product.price,
          inStock: product.inStock,
          url: product.productUrl,
          image: product.image || null,
          plastic: variant.plastic,
          edition: variant.edition,
          lastScraped: now,
          firstSeen: firstSeenByKey.get(key) || (aliasKey ? firstSeenByKey.get(aliasKey) : undefined) || now,
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

  if (
    previousEntryCount >= MIN_BASELINE_FOR_DROP_GUARD &&
    matched < previousEntryCount * DROP_GUARD_RATIO
  ) {
    throw new Error(
      `mergeStoreResults: ${storeKeys.join(', ')} matched only ${matched} price entries this run, ` +
        `down from ${previousEntryCount} previously (>${Math.round((1 - DROP_GUARD_RATIO) * 100)}% drop). ` +
        `Refusing to write — likely a broken scraper, not a real inventory collapse. Previous data left unchanged.`
    );
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
