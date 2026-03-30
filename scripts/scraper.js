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
const { isUsedDisc, extractVariant } = require('./stores.config.js');

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
  // ── Added to sync with data/discs.js ──────────────────────────────────────
  // Axiom (additional)
  { id: 'axiom-fireball',            name: 'Fireball',     brand: 'Axiom' },
  { id: 'axiom-mayhem',              name: 'Mayhem',       brand: 'Axiom' },
  { id: 'axiom-panic',               name: 'Panic',        brand: 'Axiom' },
  { id: 'axiom-pyro',                name: 'Pyro',         brand: 'Axiom' },
  { id: 'axiom-tempo',               name: 'Tempo',        brand: 'Axiom' },
  { id: 'axiom-tenacity',            name: 'Tenacity',     brand: 'Axiom' },
  { id: 'axiom-time-lapse',          name: 'Time-Lapse',   brand: 'Axiom' },
  // Discmania (additional)
  { id: 'discmania-apollo',          name: 'Apollo',       brand: 'Discmania' },
  { id: 'discmania-atlantis',        name: 'Atlantis',     brand: 'Discmania' },
  { id: 'discmania-cd1',             name: 'CD1',          brand: 'Discmania' },
  { id: 'discmania-dd1',             name: 'DD1',          brand: 'Discmania' },
  { id: 'discmania-essence',         name: 'Essence',      brand: 'Discmania' },
  { id: 'discmania-fd1',             name: 'FD1',          brand: 'Discmania' },
  { id: 'discmania-fenris',          name: 'Fenris',       brand: 'Discmania' },
  { id: 'discmania-fjord',           name: 'Fjord',        brand: 'Discmania' },
  { id: 'discmania-gf1',             name: 'GF1',          brand: 'Discmania' },
  { id: 'discmania-glacier',         name: 'Glacier',      brand: 'Discmania' },
  { id: 'discmania-instinct',        name: 'Instinct',     brand: 'Discmania' },
  { id: 'discmania-jokeri',          name: 'Jokeri',       brand: 'Discmania' },
  { id: 'discmania-laseri',          name: 'Laseri',       brand: 'Discmania' },
  { id: 'discmania-link',            name: 'Link',         brand: 'Discmania' },
  { id: 'discmania-logic',           name: 'Logic',        brand: 'Discmania' },
  { id: 'discmania-md1',             name: 'MD1',          brand: 'Discmania' },
  { id: 'discmania-md4',             name: 'MD4',          brand: 'Discmania' },
  { id: 'discmania-method',          name: 'Method',       brand: 'Discmania' },
  { id: 'discmania-midari',          name: 'Midari',       brand: 'Discmania' },
  { id: 'discmania-notion',          name: 'Notion',       brand: 'Discmania' },
  { id: 'discmania-origin',          name: 'Origin',       brand: 'Discmania' },
  { id: 'discmania-origo',           name: 'Origo',        brand: 'Discmania' },
  { id: 'discmania-p1x',             name: 'P1X',          brand: 'Discmania' },
  { id: 'discmania-p2x',             name: 'P2X',          brand: 'Discmania' },
  { id: 'discmania-p3x',             name: 'P3X',          brand: 'Discmania' },
  { id: 'discmania-rainmaker',       name: 'Rainmaker',    brand: 'Discmania' },
  { id: 'discmania-sparta',          name: 'Sparta',       brand: 'Discmania' },
  { id: 'discmania-splice',          name: 'Splice',       brand: 'Discmania' },
  { id: 'discmania-steady',          name: 'Steady',       brand: 'Discmania' },
  { id: 'discmania-td',              name: 'TD',           brand: 'Discmania' },
  { id: 'discmania-talisman',        name: 'Talisman',     brand: 'Discmania' },
  { id: 'discmania-theios',          name: 'Theios',       brand: 'Discmania' },
  { id: 'discmania-vanguard',        name: 'Vanguard',     brand: 'Discmania' },
  // Discraft (additional)
  { id: 'discraft-ares',             name: 'Ares',         brand: 'Discraft' },
  { id: 'discraft-athena',           name: 'Athena',       brand: 'Discraft' },
  { id: 'discraft-avenger-ss',       name: 'Avenger SS',   brand: 'Discraft' },
  { id: 'discraft-challenger',       name: 'Challenger',   brand: 'Discraft' },
  { id: 'discraft-cicada',           name: 'Cicada',       brand: 'Discraft' },
  { id: 'discraft-cigarra',          name: 'Cigarra',      brand: 'Discraft' },
  { id: 'discraft-drive',            name: 'Drive',        brand: 'Discraft' },
  { id: 'discraft-fierce',           name: 'Fierce',       brand: 'Discraft' },
  { id: 'discraft-focus',            name: 'Focus',        brand: 'Discraft' },
  { id: 'discraft-hades',            name: 'Hades',        brand: 'Discraft' },
  { id: 'discraft-heat',             name: 'Heat',         brand: 'Discraft' },
  { id: 'discraft-joy',              name: 'Joy',          brand: 'Discraft' },
  { id: 'discraft-kratos',           name: 'Kratos',       brand: 'Discraft' },
  { id: 'discraft-machete',          name: 'Machete',      brand: 'Discraft' },
  { id: 'discraft-magnet',           name: 'Magnet',       brand: 'Discraft' },
  { id: 'discraft-malita',           name: 'Malita',       brand: 'Discraft' },
  { id: 'discraft-meteor',           name: 'Meteor',       brand: 'Discraft' },
  { id: 'discraft-passion',          name: 'Passion',      brand: 'Discraft' },
  { id: 'discraft-reaper',           name: 'Reaper',       brand: 'Discraft' },
  { id: 'discraft-ringer-gt',        name: 'Ringer GT',    brand: 'Discraft' },
  { id: 'discraft-sting',            name: 'Sting',        brand: 'Discraft' },
  { id: 'discraft-swarm',            name: 'Swarm',        brand: 'Discraft' },
  { id: 'discraft-venom',            name: 'Venom',        brand: 'Discraft' },
  { id: 'discraft-vulture',          name: 'Vulture',      brand: 'Discraft' },
  { id: 'discraft-xl',               name: 'XL',           brand: 'Discraft' },
  { id: 'discraft-zeus',             name: 'Zeus',         brand: 'Discraft' },
  { id: 'discraft-zombee',           name: 'Zombee',       brand: 'Discraft' },
  // Dynamic Discs (additional)
  { id: 'dynamic-bounty',            name: 'Bounty',       brand: 'Dynamic Discs' },
  { id: 'dynamic-captain',           name: 'Captain',      brand: 'Dynamic Discs' },
  { id: 'dynamic-convict',           name: 'Convict',      brand: 'Dynamic Discs' },
  { id: 'dynamic-culprit',           name: 'Culprit',      brand: 'Dynamic Discs' },
  { id: 'dynamic-deputy',            name: 'Deputy',       brand: 'Dynamic Discs' },
  { id: 'dynamic-enforcer',          name: 'Enforcer',     brand: 'Dynamic Discs' },
  { id: 'dynamic-evader',            name: 'Evader',       brand: 'Dynamic Discs' },
  { id: 'dynamic-getaway',           name: 'Getaway',      brand: 'Dynamic Discs' },
  { id: 'dynamic-gladiator',         name: 'Gladiator',    brand: 'Dynamic Discs' },
  { id: 'dynamic-heist',             name: 'Heist',        brand: 'Dynamic Discs' },
  { id: 'dynamic-justice',           name: 'Justice',      brand: 'Dynamic Discs' },
  { id: 'dynamic-raider',            name: 'Raider',       brand: 'Dynamic Discs' },
  { id: 'dynamic-sergeant',          name: 'Sergeant',     brand: 'Dynamic Discs' },
  { id: 'dynamic-suspect',           name: 'Suspect',      brand: 'Dynamic Discs' },
  { id: 'dynamic-vandal',            name: 'Vandal',       brand: 'Dynamic Discs' },
  { id: 'dynamic-warden',            name: 'Warden',       brand: 'Dynamic Discs' },
  // Infinite Discs
  { id: 'infinite-alpaca',           name: 'Alpaca',       brand: 'Infinite Discs' },
  { id: 'infinite-anubis',           name: 'Anubis',       brand: 'Infinite Discs' },
  { id: 'infinite-artifact',         name: 'Artifact',     brand: 'Infinite Discs' },
  { id: 'infinite-aztec',            name: 'Aztec',        brand: 'Infinite Discs' },
  { id: 'infinite-centurion',        name: 'Centurion',    brand: 'Infinite Discs' },
  { id: 'infinite-chariot',          name: 'Chariot',      brand: 'Infinite Discs' },
  { id: 'infinite-czar',             name: 'Czar',         brand: 'Infinite Discs' },
  { id: 'infinite-inca',             name: 'Inca',         brand: 'Infinite Discs' },
  { id: 'infinite-maya',             name: 'Maya',         brand: 'Infinite Discs' },
  { id: 'infinite-myth',             name: 'Myth',         brand: 'Infinite Discs' },
  { id: 'infinite-pharaoh',          name: 'Pharaoh',      brand: 'Infinite Discs' },
  { id: 'infinite-ra',               name: 'Ra',           brand: 'Infinite Discs' },
  { id: 'infinite-scepter',          name: 'Scepter',      brand: 'Infinite Discs' },
  { id: 'infinite-slab',             name: 'Slab',         brand: 'Infinite Discs' },
  // Innova (additional)
  { id: 'innova-alien',              name: 'Alien',        brand: 'Innova' },
  { id: 'innova-animal',             name: 'Animal',       brand: 'Innova' },
  { id: 'innova-ape',                name: 'Ape',          brand: 'Innova' },
  { id: 'innova-archon',             name: 'Archon',       brand: 'Innova' },
  { id: 'innova-avatar',             name: 'Avatar',       brand: 'Innova' },
  { id: 'innova-aviar3',             name: 'Aviar3',       brand: 'Innova' },
  { id: 'innova-aviarx3',            name: 'AviarX3',      brand: 'Innova' },
  { id: 'innova-beast',              name: 'Beast',        brand: 'Innova' },
  { id: 'innova-bison',              name: 'Bison',        brand: 'Innova' },
  { id: 'innova-cro',                name: 'CRO',          brand: 'Innova' },
  { id: 'innova-caiman',             name: 'Caiman',       brand: 'Innova' },
  { id: 'innova-charger',            name: 'Charger',      brand: 'Innova' },
  { id: 'innova-colossus',           name: 'Colossus',     brand: 'Innova' },
  { id: 'innova-colt',               name: 'Colt',         brand: 'Innova' },
  { id: 'innova-dart',               name: 'Dart',         brand: 'Innova' },
  { id: 'innova-dominator',          name: 'Dominator',    brand: 'Innova' },
  { id: 'innova-eagle',              name: 'Eagle',        brand: 'Innova' },
  { id: 'innova-fl',                 name: 'FL',           brand: 'Innova' },
  { id: 'innova-fenris',             name: 'Fenris',       brand: 'Innova' },
  { id: 'innova-firefly',            name: 'Firefly',      brand: 'Innova' },
  { id: 'innova-firestorm',          name: 'Firestorm',    brand: 'Innova' },
  { id: 'innova-fox',                name: 'Fox',          brand: 'Innova' },
  { id: 'innova-gator',              name: 'Gator',        brand: 'Innova' },
  { id: 'innova-gorgon',             name: 'Gorgon',       brand: 'Innova' },
  { id: 'innova-hawkeye',            name: 'Hawkeye',      brand: 'Innova' },
  { id: 'innova-it',                 name: 'IT',           brand: 'Innova' },
  { id: 'innova-invader',            name: 'Invader',      brand: 'Innova' },
  { id: 'innova-invictus',           name: 'Invictus',     brand: 'Innova' },
  { id: 'innova-krait',              name: 'Krait',        brand: 'Innova' },
  { id: 'innova-mamba',              name: 'Mamba',        brand: 'Innova' },
  { id: 'innova-max',                name: 'Max',          brand: 'Innova' },
  { id: 'innova-mirage',             name: 'Mirage',       brand: 'Innova' },
  { id: 'innova-mystere',            name: 'Mystere',      brand: 'Innova' },
  { id: 'innova-panther',            name: 'Panther',      brand: 'Innova' },
  { id: 'innova-racer',              name: 'Racer',        brand: 'Innova' },
  { id: 'innova-rat',                name: 'Rat',          brand: 'Innova' },
  { id: 'innova-roadrunner',         name: 'Roadrunner',   brand: 'Innova' },
  { id: 'innova-rocx3',              name: 'RocX3',        brand: 'Innova' },
  { id: 'innova-rollo',              name: 'Rollo',        brand: 'Innova' },
  { id: 'innova-savant',             name: 'Savant',       brand: 'Innova' },
  { id: 'innova-shark',              name: 'Shark',        brand: 'Innova' },
  { id: 'innova-starfire',           name: 'Starfire',     brand: 'Innova' },
  { id: 'innova-tl',                 name: 'TL',           brand: 'Innova' },
  { id: 'innova-tl3',                name: 'TL3',          brand: 'Innova' },
  { id: 'innova-toro',               name: 'Toro',         brand: 'Innova' },
  { id: 'innova-wedge',              name: 'Wedge',        brand: 'Innova' },
  { id: 'innova-wombat3',            name: 'Wombat3',      brand: 'Innova' },
  { id: 'innova-xcaliber',           name: 'XCaliber',     brand: 'Innova' },
  // Kastaplast (additional)
  { id: 'kastaplast-lva',            name: 'Älva',         brand: 'Kastaplast' },
  { id: 'kastaplast-guld',           name: 'Guld',         brand: 'Kastaplast' },
  { id: 'kastaplast-hydrogen',       name: 'Hydrogen',     brand: 'Kastaplast' },
  { id: 'kastaplast-idog',           name: 'Idog',         brand: 'Kastaplast' },
  { id: 'kastaplast-impa',           name: 'Impa',         brand: 'Kastaplast' },
  { id: 'kastaplast-jrn',            name: 'Järn',         brand: 'Kastaplast' },
  { id: 'kastaplast-kaxe',           name: 'Kaxe',         brand: 'Kastaplast' },
  { id: 'kastaplast-kaxe-z',         name: 'Kaxe Z',       brand: 'Kastaplast' },
  { id: 'kastaplast-krut',           name: 'Krut',         brand: 'Kastaplast' },
  { id: 'kastaplast-malm',           name: 'Malm',         brand: 'Kastaplast' },
  { id: 'kastaplast-neon',           name: 'Neon',         brand: 'Kastaplast' },
  { id: 'kastaplast-nord',           name: 'Nord',         brand: 'Kastaplast' },
  { id: 'kastaplast-reko',           name: 'Reko',         brand: 'Kastaplast' },
  { id: 'kastaplast-reko-x',         name: 'Reko X',       brand: 'Kastaplast' },
  { id: 'kastaplast-silicon',        name: 'Silicon',      brand: 'Kastaplast' },
  { id: 'kastaplast-skylark',        name: 'Skylark',      brand: 'Kastaplast' },
  { id: 'kastaplast-sparrow',        name: 'Sparrow',      brand: 'Kastaplast' },
  { id: 'kastaplast-sten',           name: 'Sten',         brand: 'Kastaplast' },
  { id: 'kastaplast-stig',           name: 'Stig',         brand: 'Kastaplast' },
  { id: 'kastaplast-stl',            name: 'Stål',         brand: 'Kastaplast' },
  { id: 'kastaplast-svea',           name: 'Svea',         brand: 'Kastaplast' },
  { id: 'kastaplast-titanium',       name: 'Titanium',     brand: 'Kastaplast' },
  { id: 'kastaplast-tuff',           name: 'Tuff',         brand: 'Kastaplast' },
  { id: 'kastaplast-vass',           name: 'Vass',         brand: 'Kastaplast' },
  { id: 'kastaplast-xenon',          name: 'Xenon',        brand: 'Kastaplast' },
  // Latitude 64 (additional)
  { id: 'latitude-ballista',         name: 'Ballista',     brand: 'Latitude 64' },
  { id: 'latitude-bite',             name: 'Bite',         brand: 'Latitude 64' },
  { id: 'latitude-bolt',             name: 'Bolt',         brand: 'Latitude 64' },
  { id: 'latitude-brave',            name: 'Brave',        brand: 'Latitude 64' },
  { id: 'latitude-compass',          name: 'Compass',      brand: 'Latitude 64' },
  { id: 'latitude-core',             name: 'Core',         brand: 'Latitude 64' },
  { id: 'latitude-essence',          name: 'Essence',      brand: 'Latitude 64' },
  { id: 'latitude-founder',          name: 'Founder',      brand: 'Latitude 64' },
  { id: 'latitude-function',         name: 'Function',     brand: 'Latitude 64' },
  { id: 'latitude-fury',             name: 'Fury',         brand: 'Latitude 64' },
  { id: 'latitude-gladiator',        name: 'Gladiator',    brand: 'Latitude 64' },
  { id: 'latitude-glory',            name: 'Glory',        brand: 'Latitude 64' },
  { id: 'latitude-havoc',            name: 'Havoc',        brand: 'Latitude 64' },
  { id: 'latitude-honor',            name: 'Honor',        brand: 'Latitude 64' },
  { id: 'latitude-hope',             name: 'Hope',         brand: 'Latitude 64' },
  { id: 'latitude-instinct',         name: 'Instinct',     brand: 'Latitude 64' },
  { id: 'latitude-maul',             name: 'Maul',         brand: 'Latitude 64' },
  { id: 'latitude-mercy',            name: 'Mercy',        brand: 'Latitude 64' },
  { id: 'latitude-method',           name: 'Method',       brand: 'Latitude 64' },
  { id: 'latitude-musket',           name: 'Musket',       brand: 'Latitude 64' },
  { id: 'latitude-mutant',           name: 'Mutant',       brand: 'Latitude 64' },
  { id: 'latitude-origin',           name: 'Origin',       brand: 'Latitude 64' },
  { id: 'latitude-paradigm',         name: 'Paradigm',     brand: 'Latitude 64' },
  { id: 'latitude-peak',             name: 'Peak',         brand: 'Latitude 64' },
  { id: 'latitude-pearl',            name: 'Pearl',        brand: 'Latitude 64' },
  { id: 'latitude-pioneer',          name: 'Pioneer',      brand: 'Latitude 64' },
  { id: 'latitude-pure',             name: 'Pure',         brand: 'Latitude 64' },
  { id: 'latitude-recoil',           name: 'Recoil',       brand: 'Latitude 64' },
  { id: 'latitude-rive',             name: 'Rive',         brand: 'Latitude 64' },
  { id: 'latitude-ruby',             name: 'Ruby',         brand: 'Latitude 64' },
  { id: 'latitude-savior',           name: 'Savior',       brand: 'Latitude 64' },
  { id: 'latitude-scythe',           name: 'Scythe',       brand: 'Latitude 64' },
  { id: 'latitude-sinus',            name: 'Sinus',        brand: 'Latitude 64' },
  { id: 'latitude-spark',            name: 'Spark',        brand: 'Latitude 64' },
  { id: 'latitude-splice',           name: 'Splice',       brand: 'Latitude 64' },
  { id: 'latitude-spore',            name: 'Spore',        brand: 'Latitude 64' },
  { id: 'latitude-stiletto',         name: 'Stiletto',     brand: 'Latitude 64' },
  { id: 'latitude-strive',           name: 'Strive',       brand: 'Latitude 64' },
  { id: 'latitude-sweep',            name: 'Sweep',        brand: 'Latitude 64' },
  { id: 'latitude-trident',          name: 'Trident',      brand: 'Latitude 64' },
  { id: 'latitude-vision',           name: 'Vision',       brand: 'Latitude 64' },
  // Millennium (additional)
  { id: 'millennium-jls',            name: 'JLS',          brand: 'Millennium' },
  { id: 'millennium-orion-lf',       name: 'Orion LF',     brand: 'Millennium' },
  { id: 'millennium-polaris-ls',     name: 'Polaris LS',   brand: 'Millennium' },
  // MVP (additional)
  { id: 'mvp-anode',                 name: 'Anode',        brand: 'MVP' },
  { id: 'mvp-ascend',                name: 'Ascend',       brand: 'MVP' },
  { id: 'mvp-balance',               name: 'Balance',      brand: 'MVP' },
  { id: 'mvp-catalyst',              name: 'Catalyst',     brand: 'MVP' },
  { id: 'mvp-deflector',             name: 'Deflector',    brand: 'MVP' },
  { id: 'mvp-delirium',              name: 'Delirium',     brand: 'MVP' },
  { id: 'mvp-detour',                name: 'Detour',       brand: 'MVP' },
  { id: 'mvp-dimension',             name: 'Dimension',    brand: 'MVP' },
  { id: 'mvp-drift',                 name: 'Drift',        brand: 'MVP' },
  { id: 'mvp-echo',                  name: 'Echo',         brand: 'MVP' },
  { id: 'mvp-energy',                name: 'Energy',       brand: 'MVP' },
  { id: 'mvp-engine',                name: 'Engine',       brand: 'MVP' },
  { id: 'mvp-entropy',               name: 'Entropy',      brand: 'MVP' },
  { id: 'mvp-excite',                name: 'Excite',       brand: 'MVP' },
  { id: 'mvp-fireball',              name: 'Fireball',     brand: 'MVP' },
  { id: 'mvp-flare',                 name: 'Flare',        brand: 'MVP' },
  { id: 'mvp-glitch',                name: 'Glitch',       brand: 'MVP' },
  { id: 'mvp-impulse',               name: 'Impulse',      brand: 'MVP' },
  { id: 'mvp-inertia',               name: 'Inertia',      brand: 'MVP' },
  { id: 'mvp-ion',                   name: 'Ion',          brand: 'MVP' },
  { id: 'mvp-jet',                   name: 'Jet',          brand: 'MVP' },
  { id: 'mvp-lift',                  name: 'Lift',         brand: 'MVP' },
  { id: 'mvp-matrix',                name: 'Matrix',       brand: 'MVP' },
  { id: 'mvp-mayhem',                name: 'Mayhem',       brand: 'MVP' },
  { id: 'mvp-motion',                name: 'Motion',       brand: 'MVP' },
  { id: 'mvp-nitro',                 name: 'Nitro',        brand: 'MVP' },
  { id: 'mvp-nomad',                 name: 'Nomad',        brand: 'MVP' },
  { id: 'mvp-ohm',                   name: 'Ohm',          brand: 'MVP' },
  { id: 'mvp-orbital',               name: 'Orbital',      brand: 'MVP' },
  { id: 'mvp-panic',                 name: 'Panic',        brand: 'MVP' },
  { id: 'mvp-paradox',               name: 'Paradox',      brand: 'MVP' },
  { id: 'mvp-phase',                 name: 'Phase',        brand: 'MVP' },
  { id: 'mvp-photon',                name: 'Photon',       brand: 'MVP' },
  { id: 'mvp-pilot',                 name: 'Pilot',        brand: 'MVP' },
  { id: 'mvp-pitch',                 name: 'Pitch',        brand: 'MVP' },
  { id: 'mvp-pixel',                 name: 'Pixel',        brand: 'MVP' },
  { id: 'mvp-range',                 name: 'Range',        brand: 'MVP' },
  { id: 'mvp-reactor',               name: 'Reactor',      brand: 'MVP' },
  { id: 'mvp-relativity',            name: 'Relativity',   brand: 'MVP' },
  { id: 'mvp-resistor',              name: 'Resistor',     brand: 'MVP' },
  { id: 'mvp-runway',                name: 'Runway',       brand: 'MVP' },
  { id: 'mvp-shift',                 name: 'Shift',        brand: 'MVP' },
  { id: 'mvp-signal',                name: 'Signal',       brand: 'MVP' },
  { id: 'mvp-spin',                  name: 'Spin',         brand: 'MVP' },
  { id: 'mvp-stabilizer',            name: 'Stabilizer',   brand: 'MVP' },
  { id: 'mvp-tantrum',               name: 'Tantrum',      brand: 'MVP' },
  { id: 'mvp-teleport',              name: 'Teleport',     brand: 'MVP' },
  { id: 'mvp-tempo',                 name: 'Tempo',        brand: 'MVP' },
  { id: 'mvp-tenacity',              name: 'Tenacity',     brand: 'MVP' },
  { id: 'mvp-terra',                 name: 'Terra',        brand: 'MVP' },
  { id: 'mvp-time-lapse',            name: 'Time-Lapse',   brand: 'MVP' },
  { id: 'mvp-trace',                 name: 'Trace',        brand: 'MVP' },
  { id: 'mvp-trail',                 name: 'Trail',        brand: 'MVP' },
  { id: 'mvp-turbulence',            name: 'Turbulence',   brand: 'MVP' },
  { id: 'mvp-uplink',                name: 'Uplink',       brand: 'MVP' },
  { id: 'mvp-vanish',                name: 'Vanish',       brand: 'MVP' },
  { id: 'mvp-virus',                 name: 'Virus',        brand: 'MVP' },
  { id: 'mvp-watt',                  name: 'Watt',         brand: 'MVP' },
  { id: 'mvp-wave',                  name: 'Wave',         brand: 'MVP' },
  { id: 'mvp-wrath',                 name: 'Wrath',        brand: 'MVP' },
  { id: 'mvp-zenith',                name: 'Zenith',       brand: 'MVP' },
  // Prodigy (additional)
  { id: 'prodigy-archive',           name: 'Archive',      brand: 'Prodigy' },
  { id: 'prodigy-distortion',        name: 'Distortion',   brand: 'Prodigy' },
  { id: 'prodigy-fx-2',              name: 'FX-2',         brand: 'Prodigy' },
  { id: 'prodigy-fx-3',              name: 'FX-3',         brand: 'Prodigy' },
  { id: 'prodigy-fx-4',              name: 'FX-4',         brand: 'Prodigy' },
  { id: 'prodigy-feedback',          name: 'Feedback',     brand: 'Prodigy' },
  { id: 'prodigy-h3',                name: 'H3',           brand: 'Prodigy' },
  { id: 'prodigy-h3v2',              name: 'H3V2',         brand: 'Prodigy' },
  { id: 'prodigy-h4',                name: 'H4',           brand: 'Prodigy' },
  { id: 'prodigy-h4v2',              name: 'H4V2',         brand: 'Prodigy' },
  { id: 'prodigy-h5',                name: 'H5',           brand: 'Prodigy' },
  { id: 'prodigy-h7',                name: 'H7',           brand: 'Prodigy' },
  { id: 'prodigy-mx-1',              name: 'MX-1',         brand: 'Prodigy' },
  { id: 'prodigy-mx-2',              name: 'MX-2',         brand: 'Prodigy' },
  { id: 'prodigy-mx-3',              name: 'MX-3',         brand: 'Prodigy' },
  { id: 'prodigy-px-3',              name: 'PX-3',         brand: 'Prodigy' },
  { id: 'prodigy-reverb',            name: 'Reverb',       brand: 'Prodigy' },
  { id: 'prodigy-shadowfax',         name: 'Shadowfax',    brand: 'Prodigy' },
  { id: 'prodigy-stryder',           name: 'Stryder',      brand: 'Prodigy' },
  { id: 'prodigy-x3',                name: 'X3',           brand: 'Prodigy' },
  // Viking Discs (additional)
  { id: 'viking-avalanche',          name: 'Avalanche',    brand: 'Viking Discs' },
  { id: 'viking-hurricane',          name: 'Hurricane',    brand: 'Viking Discs' },
  { id: 'viking-pipeline',           name: 'Pipeline',     brand: 'Viking Discs' },
  { id: 'viking-quake',              name: 'Quake',        brand: 'Viking Discs' },
  { id: 'viking-rogue',              name: 'Rogue',        brand: 'Viking Discs' },
  { id: 'viking-squall',             name: 'Squall',       brand: 'Viking Discs' },
  // Westside Discs (additional)
  { id: 'westside-adder',            name: 'Adder',        brand: 'Westside Discs' },
  { id: 'westside-bear',             name: 'Bear',         brand: 'Westside Discs' },
  { id: 'westside-boatman',          name: 'Boatman',      brand: 'Westside Discs' },
  { id: 'westside-crown',            name: 'Crown',        brand: 'Westside Discs' },
  { id: 'westside-destiny',          name: 'Destiny',      brand: 'Westside Discs' },
  { id: 'westside-fortress',         name: 'Fortress',     brand: 'Westside Discs' },
  { id: 'westside-giant',            name: 'Giant',        brand: 'Westside Discs' },
  { id: 'westside-king',             name: 'King',         brand: 'Westside Discs' },
  { id: 'westside-maiden',           name: 'Maiden',       brand: 'Westside Discs' },
  { id: 'westside-prince',           name: 'Prince',       brand: 'Westside Discs' },
  { id: 'westside-shield',           name: 'Shield',       brand: 'Westside Discs' },
  { id: 'westside-swan-2',           name: 'Swan 2',       brand: 'Westside Discs' },
  { id: 'westside-tide',             name: 'Tide',         brand: 'Westside Discs' },
  { id: 'westside-underworld',       name: 'Underworld',   brand: 'Westside Discs' },
  { id: 'westside-world',            name: 'World',        brand: 'Westside Discs' },
];

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
    // WooCommerce category slugs to skip — these appear as "product_cat-{slug}" in the <li> class
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
  {
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
    shipping: 45,
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
    shipping: 45,
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
    shipping: 45,
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
  // Remove currency symbols and non-breaking spaces
  const cleaned = raw.replace(/[^\d,.\s]/g, '').trim();
  // Norwegian: thousands separator = "." or " ", decimal = ","
  // Remove thousands separators, replace decimal comma with dot
  const normalised = cleaned.replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
  const n = parseFloat(normalised);
  return isNaN(n) ? null : Math.round(n);
}

// extractVariant and isUsedDisc imported from plastic-types.js at top of file

// ── Disc matching ─────────────────────────────────────────────────────────────

/** Normalise a string for comparison: lowercase, collapse spaces, strip specials */
function norm(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

/** Try to match a raw product name to a disc in the catalog */
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
      // Very short disc names (<= 2 chars) require the brand name to also appear
      if (discName.length <= 2) {
        const brandNorm = norm(disc.brand);
        const brandPattern = new RegExp('(?:^|\\s)' + brandNorm.replace(/\s+/g, '\\s+') + '(?:\\s|$)', 'i');
        if (!brandPattern.test(normalised)) continue;
      }
      const score = discName.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = disc;
      }
    }
  }

  if (bestMatch) {
    if (bestScore <= 2 || (bestScore / normalised.length) < 0.2) {
      console.log(`  [low-confidence] "${rawProductName}" → ${bestMatch.id} (nameLen=${bestScore}, productLen=${normalised.length})`);
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
