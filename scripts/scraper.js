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

// ── Disc catalog (mirrors data/discs.js — keep in sync) ─────────────────────
const DISC_CATALOG = [
  // Original 17
  { id: 'innova-destroyer',          name: 'Destroyer',    brand: 'Innova' },
  { id: 'discraft-buzzz',            name: 'Buzzz',        brand: 'Discraft' },
  { id: 'axiom-bokeh-lizotte',       name: 'Bokeh',        brand: 'Axiom' },
  { id: 'discmania-pd2',             name: 'PD2',          brand: 'Discmania' },
  { id: 'kastaplast-berg',           name: 'Berg',         brand: 'Kastaplast' },
  { id: 'mvp-atom',                  name: 'Atom',         brand: 'MVP' },
  { id: 'latitude-flow',             name: 'Flow',         brand: 'Latitude 64' },
  { id: 'innova-aviar',              name: 'Aviar',        brand: 'Innova' },
  { id: 'dynamic-trespass',          name: 'Trespass',     brand: 'Dynamic Discs' },
  { id: 'prodigy-pa3-lizotte',       name: 'PA-3',         brand: 'Prodigy' },
  { id: 'discmania-cloudbreaker',    name: 'Cloud Breaker',brand: 'Discmania' },
  { id: 'innova-leopard',            name: 'Leopard',      brand: 'Innova' },
  { id: 'innova-roc',                name: 'Roc',          brand: 'Innova' },
  { id: 'innova-wraith',             name: 'Wraith',       brand: 'Innova' },
  { id: 'innova-sidewinder',         name: 'Sidewinder',   brand: 'Innova' },
  { id: 'dynamic-escape',            name: 'Escape',       brand: 'Dynamic Discs' },
  { id: 'discraft-zone',             name: 'Zone',         brand: 'Discraft' },
  // Innova
  { id: 'innova-boss',               name: 'Boss',         brand: 'Innova' },
  { id: 'innova-corvette',           name: 'Corvette',     brand: 'Innova' },
  { id: 'innova-daedalus',           name: 'Daedalus',     brand: 'Innova' },
  { id: 'innova-firebird',           name: 'Firebird',     brand: 'Innova' },
  { id: 'innova-gazelle',            name: 'Gazelle',      brand: 'Innova' },
  { id: 'innova-jay',                name: 'Jay',          brand: 'Innova' },
  { id: 'innova-katana',             name: 'Katana',       brand: 'Innova' },
  { id: 'innova-leopard3',           name: 'Leopard3',     brand: 'Innova' },
  { id: 'innova-liger',              name: 'Liger',        brand: 'Innova' },
  { id: 'innova-lion',               name: 'Lion',         brand: 'Innova' },
  { id: 'innova-mako3',              name: 'Mako3',        brand: 'Innova' },
  { id: 'innova-nova',               name: 'Nova',         brand: 'Innova' },
  { id: 'innova-orc',                name: 'Orc',          brand: 'Innova' },
  { id: 'innova-pig',                name: 'Pig',          brand: 'Innova' },
  { id: 'innova-rancho',             name: 'Rancho',       brand: 'Innova' },
  { id: 'innova-rhyno',              name: 'Rhyno',        brand: 'Innova' },
  { id: 'innova-roc3',               name: 'Roc3',         brand: 'Innova' },
  { id: 'innova-shryke',             name: 'Shryke',       brand: 'Innova' },
  { id: 'innova-stingray',           name: 'Stingray',     brand: 'Innova' },
  { id: 'innova-teedevil',           name: 'TeeDevil',     brand: 'Innova' },
  { id: 'innova-teebird',            name: 'Teebird',      brand: 'Innova' },
  { id: 'innova-teebird3',           name: 'Teebird3',     brand: 'Innova' },
  { id: 'innova-tern',               name: 'Tern',         brand: 'Innova' },
  { id: 'innova-thunderbird',        name: 'Thunderbird',  brand: 'Innova' },
  { id: 'innova-valkyrie',           name: 'Valkyrie',     brand: 'Innova' },
  { id: 'innova-viking',             name: 'Viking',       brand: 'Innova' },
  { id: 'innova-vroc',               name: 'Vroc',         brand: 'Innova' },
  { id: 'innova-wolf',               name: 'Wolf',         brand: 'Innova' },
  { id: 'innova-xt-nova',            name: 'XT Nova',      brand: 'Innova' },
  // Discraft
  { id: 'discraft-anax',             name: 'Anax',         brand: 'Discraft' },
  { id: 'discraft-banger-gt',        name: 'Banger GT',    brand: 'Discraft' },
  { id: 'discraft-buzzz-gt',         name: 'Buzzz GT',     brand: 'Discraft' },
  { id: 'discraft-buzzz-os',         name: 'Buzzz OS',     brand: 'Discraft' },
  { id: 'discraft-comet',            name: 'Comet',        brand: 'Discraft' },
  { id: 'discraft-crank',            name: 'Crank',        brand: 'Discraft' },
  { id: 'discraft-crush',            name: 'Crush',        brand: 'Discraft' },
  { id: 'discraft-cyclone',          name: 'Cyclone',      brand: 'Discraft' },
  { id: 'discraft-drone',            name: 'Drone',        brand: 'Discraft' },
  { id: 'discraft-enigma',           name: 'Enigma',       brand: 'Discraft' },
  { id: 'discraft-flick',            name: 'Flick',        brand: 'Discraft' },
  { id: 'discraft-force',            name: 'Force',        brand: 'Discraft' },
  { id: 'discraft-ghost',            name: 'Ghost',        brand: 'Discraft' },
  { id: 'discraft-hornet',           name: 'Hornet',       brand: 'Discraft' },
  { id: 'discraft-luna',             name: 'Luna',         brand: 'Discraft' },
  { id: 'discraft-malta',            name: 'Malta',        brand: 'Discraft' },
  { id: 'discraft-mantis',           name: 'Mantis',       brand: 'Discraft' },
  { id: 'discraft-nuke',             name: 'Nuke',         brand: 'Discraft' },
  { id: 'discraft-nuke-os',          name: 'Nuke OS',      brand: 'Discraft' },
  { id: 'discraft-predator',         name: 'Predator',     brand: 'Discraft' },
  { id: 'discraft-raptor',           name: 'Raptor',       brand: 'Discraft' },
  { id: 'discraft-roach',            name: 'Roach',        brand: 'Discraft' },
  { id: 'discraft-scorch',           name: 'Scorch',       brand: 'Discraft' },
  { id: 'discraft-sol',              name: 'Sol',          brand: 'Discraft' },
  { id: 'discraft-stalker',          name: 'Stalker',      brand: 'Discraft' },
  { id: 'discraft-static',           name: 'Static',       brand: 'Discraft' },
  { id: 'discraft-stratus',          name: 'Stratus',      brand: 'Discraft' },
  { id: 'discraft-surge',            name: 'Surge',        brand: 'Discraft' },
  { id: 'discraft-thrasher',         name: 'Thrasher',     brand: 'Discraft' },
  { id: 'discraft-undertaker',       name: 'Undertaker',   brand: 'Discraft' },
  { id: 'discraft-viper',            name: 'Viper',        brand: 'Discraft' },
  { id: 'discraft-wasp',             name: 'Wasp',         brand: 'Discraft' },
  { id: 'discraft-zone-os',          name: 'Zone OS',      brand: 'Discraft' },
  // Dynamic Discs
  { id: 'dynamic-evidence',          name: 'Evidence',     brand: 'Dynamic Discs' },
  { id: 'dynamic-felon',             name: 'Felon',        brand: 'Dynamic Discs' },
  { id: 'dynamic-freedom',           name: 'Freedom',      brand: 'Dynamic Discs' },
  { id: 'dynamic-fugitive',          name: 'Fugitive',     brand: 'Dynamic Discs' },
  { id: 'dynamic-judge',             name: 'Judge',        brand: 'Dynamic Discs' },
  { id: 'dynamic-maverick',          name: 'Maverick',     brand: 'Dynamic Discs' },
  { id: 'dynamic-renegade',          name: 'Renegade',     brand: 'Dynamic Discs' },
  { id: 'dynamic-sheriff',           name: 'Sheriff',      brand: 'Dynamic Discs' },
  { id: 'dynamic-truth',             name: 'Truth',        brand: 'Dynamic Discs' },
  { id: 'dynamic-verdict',           name: 'Verdict',      brand: 'Dynamic Discs' },
  // Latitude 64
  { id: 'latitude-anchor',           name: 'Anchor',       brand: 'Latitude 64' },
  { id: 'latitude-ballista-pro',     name: 'Ballista Pro', brand: 'Latitude 64' },
  { id: 'latitude-claymore',         name: 'Claymore',     brand: 'Latitude 64' },
  { id: 'latitude-diamond',          name: 'Diamond',      brand: 'Latitude 64' },
  { id: 'latitude-explorer',         name: 'Explorer',     brand: 'Latitude 64' },
  { id: 'latitude-fuse',             name: 'Fuse',         brand: 'Latitude 64' },
  { id: 'latitude-gauntlet',         name: 'Gauntlet',     brand: 'Latitude 64' },
  { id: 'latitude-grace',            name: 'Grace',        brand: 'Latitude 64' },
  { id: 'latitude-guard',            name: 'Guard',        brand: 'Latitude 64' },
  { id: 'latitude-jade',             name: 'Jade',         brand: 'Latitude 64' },
  { id: 'latitude-keystone',         name: 'Keystone',     brand: 'Latitude 64' },
  { id: 'latitude-missilen',         name: 'Missilen',     brand: 'Latitude 64' },
  { id: 'latitude-river',            name: 'River',        brand: 'Latitude 64' },
  { id: 'latitude-saint',            name: 'Saint',        brand: 'Latitude 64' },
  { id: 'latitude-saint-pro',        name: 'Saint Pro',    brand: 'Latitude 64' },
  { id: 'latitude-sapphire',         name: 'Sapphire',     brand: 'Latitude 64' },
  { id: 'latitude-trust',            name: 'Trust',        brand: 'Latitude 64' },
  { id: 'latitude-volt',             name: 'Volt',         brand: 'Latitude 64' },
  // Kastaplast
  { id: 'kastaplast-falk',           name: 'Falk',         brand: 'Kastaplast' },
  { id: 'kastaplast-grym',           name: 'Grym',         brand: 'Kastaplast' },
  { id: 'kastaplast-grym-x',         name: 'Grym X',       brand: 'Kastaplast' },
  { id: 'kastaplast-gote',           name: 'Göte',         brand: 'Kastaplast' },
  { id: 'kastaplast-lots',           name: 'Lots',         brand: 'Kastaplast' },
  { id: 'kastaplast-rask',           name: 'Rask',         brand: 'Kastaplast' },
  { id: 'kastaplast-svart',          name: 'Svart',        brand: 'Kastaplast' },
  // Westside
  { id: 'westside-harp',             name: 'Harp',         brand: 'Westside Discs' },
  { id: 'westside-stag',             name: 'Stag',         brand: 'Westside Discs' },
  { id: 'westside-swan-1',           name: 'Swan 1',       brand: 'Westside Discs' },
  { id: 'westside-sword',            name: 'Sword',        brand: 'Westside Discs' },
  { id: 'westside-tursas',           name: 'Tursas',       brand: 'Westside Discs' },
  { id: 'westside-warship',          name: 'Warship',      brand: 'Westside Discs' },
  // Axiom
  { id: 'axiom-alias',               name: 'Alias',        brand: 'Axiom' },
  { id: 'axiom-crave',               name: 'Crave',        brand: 'Axiom' },
  { id: 'axiom-defy',                name: 'Defy',         brand: 'Axiom' },
  { id: 'axiom-envy',                name: 'Envy',         brand: 'Axiom' },
  { id: 'axiom-hex',                 name: 'Hex',          brand: 'Axiom' },
  { id: 'axiom-insanity',            name: 'Insanity',     brand: 'Axiom' },
  { id: 'axiom-proxy',               name: 'Proxy',        brand: 'Axiom' },
  { id: 'axiom-rhythm',              name: 'Rhythm',       brand: 'Axiom' },
  // MVP
  { id: 'mvp-octane',                name: 'Octane',       brand: 'MVP' },
  { id: 'mvp-relay',                 name: 'Relay',        brand: 'MVP' },
  { id: 'mvp-servo',                 name: 'Servo',        brand: 'MVP' },
  { id: 'mvp-tesla',                 name: 'Tesla',        brand: 'MVP' },
  // Discmania
  { id: 'discmania-active',          name: 'Active',       brand: 'Discmania' },
  { id: 'discmania-cd',              name: 'CD',           brand: 'Discmania' },
  { id: 'discmania-cd2',             name: 'CD2',          brand: 'Discmania' },
  { id: 'discmania-cd3',             name: 'CD3',          brand: 'Discmania' },
  { id: 'discmania-dd',              name: 'DD',           brand: 'Discmania' },
  { id: 'discmania-dd2',             name: 'DD2',          brand: 'Discmania' },
  { id: 'discmania-dd3',             name: 'DD3',          brand: 'Discmania' },
  { id: 'discmania-fd',              name: 'FD',           brand: 'Discmania' },
  { id: 'discmania-fd2',             name: 'FD2',          brand: 'Discmania' },
  { id: 'discmania-fd3',             name: 'FD3',          brand: 'Discmania' },
  { id: 'discmania-md',              name: 'MD',           brand: 'Discmania' },
  { id: 'discmania-md2',             name: 'MD2',          brand: 'Discmania' },
  { id: 'discmania-md3',             name: 'MD3',          brand: 'Discmania' },
  { id: 'discmania-md5',             name: 'MD5',          brand: 'Discmania' },
  { id: 'discmania-pd',              name: 'PD',           brand: 'Discmania' },
  { id: 'discmania-pd3',             name: 'PD3',          brand: 'Discmania' },
  { id: 'discmania-p1',              name: 'P1',           brand: 'Discmania' },
  { id: 'discmania-p2',              name: 'P2',           brand: 'Discmania' },
  { id: 'discmania-p3',              name: 'P3',           brand: 'Discmania' },
  { id: 'discmania-tactic',          name: 'Tactic',       brand: 'Discmania' },
  // Prodigy
  { id: 'prodigy-a1',                name: 'A1',           brand: 'Prodigy' },
  { id: 'prodigy-a2',                name: 'A2',           brand: 'Prodigy' },
  { id: 'prodigy-a3',                name: 'A3',           brand: 'Prodigy' },
  { id: 'prodigy-a4',                name: 'A4',           brand: 'Prodigy' },
  { id: 'prodigy-d1',                name: 'D1',           brand: 'Prodigy' },
  { id: 'prodigy-d2',                name: 'D2',           brand: 'Prodigy' },
  { id: 'prodigy-d3',                name: 'D3',           brand: 'Prodigy' },
  { id: 'prodigy-d4',                name: 'D4',           brand: 'Prodigy' },
  { id: 'prodigy-f1',                name: 'F1',           brand: 'Prodigy' },
  { id: 'prodigy-f3',                name: 'F3',           brand: 'Prodigy' },
  { id: 'prodigy-f5',                name: 'F5',           brand: 'Prodigy' },
  { id: 'prodigy-h1',                name: 'H1',           brand: 'Prodigy' },
  { id: 'prodigy-h2',                name: 'H2',           brand: 'Prodigy' },
  { id: 'prodigy-m1',                name: 'M1',           brand: 'Prodigy' },
  { id: 'prodigy-m2',                name: 'M2',           brand: 'Prodigy' },
  { id: 'prodigy-m3',                name: 'M3',           brand: 'Prodigy' },
  { id: 'prodigy-m4',                name: 'M4',           brand: 'Prodigy' },
  { id: 'prodigy-pa1',               name: 'PA-1',         brand: 'Prodigy' },
  { id: 'prodigy-pa2',               name: 'PA-2',         brand: 'Prodigy' },
  { id: 'prodigy-pa4',               name: 'PA-4',         brand: 'Prodigy' },
];

// ── Store configs ─────────────────────────────────────────────────────────────
const STORES = [
  {
    key: 'wearediscgolf',
    name: 'We Are Disc Golf',
    baseUrl: 'https://wearediscgolf.no',
    freeShippingOver: 899,
    shipping: 99,
    categories: [
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1000',
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1001',
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1002',
      'https://wearediscgolf.no/product-category/golfdiscer/?_disc_type=1003',
    ],
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
  {
    key: 'aceshop',
    name: 'Aceshop',
    baseUrl: 'https://aceshop.no',
    freeShippingOver: 599,
    shipping: 99,
    categories: [
      'https://aceshop.no/product-category/discgolf/discer/putt-approach/',
      'https://aceshop.no/product-category/discgolf/discer/midrange/',
      'https://aceshop.no/product-category/discgolf/discer/fairway-driver/',
      'https://aceshop.no/product-category/discgolf/discer/distance-driver/',
    ],
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
  {
    key: 'frisbeesor',
    name: 'Frisbee Sør',
    baseUrl: 'https://frisbeesor.no',
    freeShippingOver: 699,
    shipping: 99,
    categories: [
      'https://frisbeesor.no/product-category/discer/',
    ],
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
  {
    key: 'golfdiscer',
    name: 'GolfDiscer',
    baseUrl: 'https://golfdiscer.no',
    freeShippingOver: 799,
    shipping: 99,
    categories: [
      'https://golfdiscer.no/product-category/discer/',
    ],
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
  {
    key: 'frisbeebutikken',
    name: 'Frisbeebutikken',
    baseUrl: 'https://frisbeebutikken.no',
    freeShippingOver: 699,
    shipping: 99,
    type: 'woocommerce',
    categories: [
      'https://frisbeebutikken.no/product-category/discer/',
    ],
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
    shipping: 99,
    type: 'shopify',
  },
  {
    key: 'arcticdisc',
    name: 'Arctic Disc',
    baseUrl: 'https://arcticdisc.no',
    freeShippingOver: 1199,
    shipping: 99,
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
  // Remove currency symbols and non-breaking spaces
  const cleaned = raw.replace(/[^\d,.\s]/g, '').trim();
  // Norwegian: thousands separator = "." or " ", decimal = ","
  // Remove thousands separators, replace decimal comma with dot
  const normalised = cleaned.replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
  const n = parseFloat(normalised);
  return isNaN(n) ? null : Math.round(n);
}

// ── Disc matching ─────────────────────────────────────────────────────────────

/** Normalise a string for comparison: lowercase, collapse spaces, strip specials */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Try to match a raw product name to a disc in the catalog */
function matchDisc(rawProductName) {
  const normalised = norm(rawProductName);
  let bestMatch = null;
  let bestScore = 0;

  for (const disc of DISC_CATALOG) {
    const discName = norm(disc.name);
    // Build a word-boundary pattern for the disc name
    // Replace spaces with flexible whitespace in the pattern
    const pattern = new RegExp(
      '(?:^|\\s)' + discName.replace(/\s+/g, '\\s+') + '(?:\\s|$)',
      'i'
    );
    if (pattern.test(normalised)) {
      const score = discName.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = disc;
      }
    }
  }

  return bestMatch;
}

// ── Page scraper ──────────────────────────────────────────────────────────────

function scrapeProductsFromHtml(html, store) {
  const $ = cheerio.load(html);
  const sel = store.selectors;
  const products = [];

  $(sel.productCard).each((_, el) => {
    const card = $(el);

    const nameEl = card.find(sel.name);
    const rawName = nameEl.text().trim();
    if (!rawName) return;

    // Price — grab the first price amount (ignore sale/original price dupe)
    const priceEl = card.find(sel.price).first();
    const rawPrice = priceEl.text().trim();
    const price = parseNOKPrice(rawPrice);
    if (!price) return; // skip if we can't parse a price

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

    products.push({ rawName, price, productUrl, inStock });
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
      const inStock = availableVariants.length > 0;
      const productUrl = `${store.baseUrl}/products/${product.handle}`;

      allProducts.push({ rawName, price, productUrl, inStock });
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
        // Avoid duplicate store entries for the same disc
        const existing = prices[disc.id].find((e) => e.store === store.key);
        if (!existing || product.price < existing.price) {
          // Keep the cheapest listing per store per disc
          if (existing) {
            existing.price = product.price;
            existing.inStock = product.inStock;
            existing.url = product.productUrl;
            existing.lastScraped = now;
          } else {
            prices[disc.id].push({
              store: store.key,
              price: product.price,
              inStock: product.inStock,
              url: product.productUrl,
              lastScraped: now,
            });
          }
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
