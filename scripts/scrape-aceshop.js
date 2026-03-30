'use strict';

// scripts/scrape-aceshop.js — standalone scraper for aceshop.no
// Attempt 1: enhanced browser-like headers (fast, no dependencies beyond node-fetch/cheerio)
// Attempt 2: Playwright headless Chromium (fallback if bot protection blocks headers)
//
// Reads existing data/scraped-prices.json, merges aceshop results in, writes back.
// Usage: node scripts/scrape-aceshop.js   or   pnpm scrape:ace

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { extractVariant, isUsedDisc } = require('./stores.config.js');

// ── Store config ──────────────────────────────────────────────────────────────

const STORE = {
  key: 'aceshop',
  name: 'Aceshop',
  baseUrl: 'https://aceshop.no',
  freeShippingOver: 599,
  shipping: 45,
  categories: [
    'https://aceshop.no/product-category/discgolf/discer/putt-approach/',
    'https://aceshop.no/product-category/discgolf/discer/midrange/',
    'https://aceshop.no/product-category/discgolf/discer/fairway-driver/',
    'https://aceshop.no/product-category/discgolf/discer/distance-driver/',
  ],
};

const SEL = {
  productCard:   'li.product',
  name:          'h2.woocommerce-loop-product__title',
  price:         'span.woocommerce-Price-amount bdi',
  link:          'a.woocommerce-LoopProduct-link',
  outOfStock:    '.out-of-stock, .button.disabled',
  outOfStockText:'utsolgt',
  nextPage:      'a.next.page-numbers',
  image:         'a.woocommerce-LoopProduct-link img',
};

// ── Disc catalog (mirrors data/discs.js — keep in sync) ──────────────────────

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
  { id: 'discmania-cloudbreaker',    name: 'Cloud Breaker', brand: 'Discmania' },
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
  // RPM Discs
  { id: 'rpm-ruru',                  name: 'Ruru',         brand: 'RPM Discs' },
  { id: 'rpm-kea',                   name: 'Kea',          brand: 'RPM Discs' },
  { id: 'rpm-weka',                  name: 'Weka',         brand: 'RPM Discs' },
  { id: 'rpm-tui',                   name: 'Tui',          brand: 'RPM Discs' },
  { id: 'rpm-aotearoa',              name: 'Aotearoa',     brand: 'RPM Discs' },
  { id: 'rpm-kotare',                name: 'Kotare',       brand: 'RPM Discs' },
  { id: 'rpm-kiwi',                  name: 'Kiwi',         brand: 'RPM Discs' },
  { id: 'rpm-huia',                  name: 'Huia',         brand: 'RPM Discs' },
  { id: 'rpm-kotuku',                name: 'Kotuku',       brand: 'RPM Discs' },
  { id: 'rpm-takapu',                name: 'Takapu',       brand: 'RPM Discs' },
  { id: 'rpm-kahu',                  name: 'Kahu',         brand: 'RPM Discs' },
  { id: 'rpm-taipan',                name: 'Taipan',       brand: 'RPM Discs' },
  { id: 'rpm-destiny',               name: 'Destiny',      brand: 'RPM Discs' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function randomDelay(min = 2000, max = 5000) {
  return sleep(min + Math.random() * (max - min));
}

/** Parse Norwegian price string "249,00" or "1.249,00" → 249 */
function parseNOKPrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d,.\s]/g, '').trim();
  const normalised = cleaned.replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
  const n = parseFloat(normalised);
  return isNaN(n) ? null : Math.round(n);
}

// extractVariant and isUsedDisc imported from plastic-types.js at top of file

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const NON_DISC_KEYWORDS = [
  'bag', 'sekk', 'ryggsekk', 'basket', 'kurv', 'armbånd', 'handledds',
  'towel', 'håndkle', 'marker', 'kasse', 'mold',
];

function isDiscProduct(rawName) {
  const lower = rawName.toLowerCase();
  return !NON_DISC_KEYWORDS.some(kw =>
    new RegExp('(?:^|[\\s,/])' + kw + '(?:[\\s,/]|$)').test(lower)
  );
}

function matchDisc(rawProductName) {
  if (!isDiscProduct(rawProductName)) return null;

  const normalised = norm(rawProductName);
  let bestMatch = null;
  let bestScore = 0;
  for (const disc of DISC_CATALOG) {
    const discName = norm(disc.name);
    const pattern = new RegExp(
      '(?:^|\\s)' + discName.replace(/\s+/g, '\\s+') + '(?:\\s|$)',
      'i'
    );
    if (pattern.test(normalised)) {
      if (discName.length <= 2) {
        const brandNorm = norm(disc.brand);
        const brandPattern = new RegExp('(?:^|\\s)' + brandNorm.replace(/\s+/g, '\\s+') + '(?:\\s|$)', 'i');
        if (!brandPattern.test(normalised)) continue;
      }
      const score = discName.length;
      if (score > bestScore) { bestScore = score; bestMatch = disc; }
    }
  }
  if (bestMatch && (bestScore <= 2 || (bestScore / normalised.length) < 0.2)) {
    console.log(`  [low-confidence] "${rawProductName}" → ${bestMatch.id} (nameLen=${bestScore})`);
  }
  return bestMatch;
}

// ── HTML product parsing ──────────────────────────────────────────────────────

function parseProductsFromHtml(html) {
  const $ = cheerio.load(html);
  const products = [];

  $(SEL.productCard).each((_, el) => {
    const card = $(el);

    const rawName = card.find(SEL.name).text().trim();
    if (!rawName) return;

    const rawPrice = card.find(SEL.price).first().text().trim();
    const price = parseNOKPrice(rawPrice);
    if (!price) return;

    const linkEl = card.find(SEL.link).first();
    const href = linkEl.attr('href') || '';
    const productUrl = href.startsWith('http') ? href : STORE.baseUrl + href;

    const cardText = card.text().toLowerCase();
    const hasOutOfStockClass = card.hasClass('out-of-stock') || card.find(SEL.outOfStock).length > 0;
    const inStock = !hasOutOfStockClass && !cardText.includes(SEL.outOfStockText);

    const imgEl = card.find(SEL.image).first();
    const image = imgEl.attr('src') || imgEl.attr('data-src') || null;

    if (!isUsedDisc(rawName)) products.push({ rawName, price, productUrl, inStock, image });
  });

  const nextPage = $(SEL.nextPage).first().attr('href') || null;
  return { products, nextPage };
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
    (html.length < 10000 && !lower.includes('woocommerce'))
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
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function scrapeWithHeaders() {
  console.log('  Attempt 1: enhanced fetch headers');
  const allProducts = [];
  const seenUrls = new Set();
  let blockedOnFirstPage = false;

  for (const categoryUrl of STORE.categories) {
    let pageUrl = categoryUrl;
    let pageNum = 1;

    while (pageUrl) {
      console.log(`    ${STORE.key} p${pageNum}: ${pageUrl}`);
      let html;
      try {
        // First category page looks like a fresh navigation from Google;
        // subsequent pages look like same-site navigation.
        const referer = pageNum === 1 ? 'https://www.google.no/' : STORE.baseUrl + '/';
        html = await fetchPage(pageUrl, referer);
      } catch (err) {
        console.warn(`    ⚠ ${err.message}`);
        break;
      }

      const { products, nextPage } = parseProductsFromHtml(html);

      if (pageNum === 1 && isChallengePage(html, products.length)) {
        console.log(`    ✗ Bot protection detected on ${categoryUrl}`);
        blockedOnFirstPage = true;
        break;
      }

      for (const p of products) {
        if (!seenUrls.has(p.productUrl)) {
          seenUrls.add(p.productUrl);
          allProducts.push(p);
        }
      }

      console.log(`    → ${products.length} products on this page`);

      await randomDelay(2000, 3000);

      if (nextPage && !seenUrls.has(nextPage)) {
        seenUrls.add(nextPage);
        pageUrl = nextPage;
        pageNum++;
      } else {
        break;
      }
    }

    if (blockedOnFirstPage) break;
  }

  if (blockedOnFirstPage || allProducts.length === 0) {
    console.log('  Attempt 1 failed — switching to Playwright\n');
    return null;
  }

  console.log(`  Attempt 1 succeeded: ${allProducts.length} products found\n`);
  return allProducts;
}

// ── Attempt 2: Playwright headless browser ────────────────────────────────────
//
// aceshop.no uses Elementor Loop Builder — the product grid is 100% JS-rendered.
// Products live in .e-loop-item cards; pagination uses Elementor's load-more
// pattern with /page/N/ URLs and a data-max-page attribute.
//
// Product name comes from the add-to-cart button's aria-label: «DISC NAME».
// Images are not rendered in the listing cards, so image will be null.

/** Extract products from the current Playwright page using Elementor selectors */
async function extractProductsFromPage(page) {
  // Scroll slowly to trigger lazy-loaded price elements
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0;
      const step = () => {
        window.scrollBy(0, 120 + Math.floor(Math.random() * 60));
        y += 120;
        if (y < document.body.scrollHeight * 0.9) {
          setTimeout(step, 80 + Math.floor(Math.random() * 60));
        } else {
          resolve();
        }
      };
      setTimeout(step, 200);
    });
  });
  await sleep(1500);

  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.e-loop-item')).map((card) => {
      // Product URL + raw name from the add-to-cart button aria-label
      const btn = card.querySelector(
        'a.add_to_cart_button, a.button[href*="/product/"]'
      );
      if (!btn) return null;

      const ariaLabel = btn.getAttribute('aria-label') || '';
      const nameMatch = ariaLabel.match(/\u00ab(.+)\u00bb/); // «name»
      const rawName = nameMatch ? nameMatch[1] : null;
      if (!rawName) return null;

      const productUrl = btn.href;

      // Price — only populated after scroll
      const priceEl = card.querySelector('span.woocommerce-Price-amount.amount');
      const rawPrice = priceEl ? priceEl.textContent.trim() : null;

      // Out-of-stock: standard WooCommerce class or disabled add-to-cart
      const outOfStockEl = card.querySelector(
        '.out-of-stock, .stock.out-of-stock'
      );
      const btnDisabled =
        btn.classList.contains('disabled') ||
        btn.getAttribute('aria-disabled') === 'true';
      const inStock = !outOfStockEl && !btnDisabled;

      // Images not rendered in the listing view — null here
      return { rawName, productUrl, rawPrice, inStock, image: null };
    }).filter(Boolean);
  });
}

/** Build paginated URL for a category: base/page/N/ */
function pageUrl(categoryUrl, n) {
  if (n <= 1) return categoryUrl;
  const base = categoryUrl.replace(/\/$/, '');
  return `${base}/page/${n}/`;
}

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

  const browser = await pw.chromium.launch({ headless: true });
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
    // Warm up: visit homepage to establish session/cookies
    console.log(`    Visiting ${STORE.baseUrl}...`);
    await page.goto(STORE.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 3000);

    for (const categoryUrl of STORE.categories) {
      // Page 1 — also determines how many pages there are
      const firstUrl = pageUrl(categoryUrl, 1);
      console.log(`    ${STORE.key}: ${firstUrl}`);
      await page.goto(firstUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const maxPage = await page.evaluate(() => {
        const anchor = document.querySelector('.e-load-more-anchor');
        return anchor ? parseInt(anchor.dataset.maxPage || '1', 10) : 1;
      });
      console.log(`      → ${maxPage} page(s) in this category`);

      for (let p = 1; p <= maxPage; p++) {
        if (p > 1) {
          const url = pageUrl(categoryUrl, p);
          console.log(`    ${STORE.key} p${p}: ${url}`);
          await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        }

        const products = await extractProductsFromPage(page);

        for (const prod of products) {
          if (!seenUrls.has(prod.productUrl)) {
            seenUrls.add(prod.productUrl);
            // Parse price here where we have the helper
            const price = parseNOKPrice(prod.rawPrice);
            if (price && !isUsedDisc(prod.rawName)) {
              allProducts.push({
                rawName:    prod.rawName,
                price,
                productUrl: prod.productUrl,
                inStock:    prod.inStock,
                image:      prod.image,
              });
            }
          }
        }

        console.log(`      → ${products.length} products (running total: ${allProducts.length})`);
        await randomDelay(2000, 4000);
      }
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

  // Ensure store metadata is present
  data.stores[STORE.key] = {
    name:            STORE.name,
    url:             STORE.baseUrl,
    freeShippingOver: STORE.freeShippingOver,
    shipping:        STORE.shipping,
  };

  // Remove stale aceshop entries so we replace them cleanly
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
        existing.price = product.price;
        existing.inStock = product.inStock;
        existing.url = product.productUrl;
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

  // Merge into unmatched-products.json (removes old aceshop entries first)
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
//
// aceshop.no renders its product grid entirely via JavaScript — the static HTML
// is a shell only. Attempt 1 (headers) is kept as a fast pre-check: if the
// product grid is ever served server-side it will be used. Otherwise the script
// falls through to Playwright.
//
// System deps required for Playwright on Ubuntu 24.04 (WSL2):
//   sudo apt-get install -y libnspr4 libnss3 libasound2t64

async function main() {
  const now = new Date().toISOString();
  console.log(`Aceshop scraper — ${now}`);
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
