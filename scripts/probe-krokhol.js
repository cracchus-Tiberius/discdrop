'use strict';

// scripts/probe-krokhol.js — TEMPORARY investigation script for krokholdgs.no
// (Krokhol Disc Golf Shop, Norwegian store, NOK).
//
// Purpose: answer the one question that decides how Krokhol gets added, then
// be deleted. It writes NOTHING — no scraped-prices.json, no
// unmatched-products.json.
//
//   Shopify or WooCommerce  → Krokhol is an ~8-line config entry in
//                             scripts/scraper.js's STORES array. No new code.
//   Mystore                 → scraper.js can't read it (JSON APIs only).
//                             Extract the addToCart parser that
//                             scrape-frisbeebutikken.js and
//                             scrape-starframe.js currently BOTH carry
//                             near-verbatim ("keep both in sync" per their own
//                             comments) into scripts/lib/mystore.js, and make
//                             all three stores config-driven off it.
//
// Reuses the real matching path (stores.config.js's matchDisc/extractVariant
// and the used/mini/non-disc filters) and the real 50 kr price floor
// (lib/price-changes.js's MIN_VALID_PRICE_NOK), so the match rate it reports
// is the rate the live pipeline would produce — not an approximation.
//
// Usage: node scripts/probe-krokhol.js

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const {
  isUsedDisc, isMiniDisc, isNonDiscProduct, isUsedProductMeta,
  matchDisc, extractVariant, SKIP_CATEGORY_SLUGS,
} = require('./stores.config.js');
const { MIN_VALID_PRICE_NOK, MAX_VALID_PRICE_NOK } = require('./lib/price-changes.js');

const BASE = 'https://krokholdgs.no';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const HTML_HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'nb-NO,nb;q=0.9,no;q=0.8,en;q=0.5',
};
const JSON_HEADERS = { 'User-Agent': UA, 'Accept': 'application/json,text/plain,*/*' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function keep(rawName) {
  return Boolean(rawName) && !isUsedDisc(rawName) && !isMiniDisc(rawName) && !isNonDiscProduct(rawName);
}

// Handles Mystore's "189,-", the "1 025,-" thousands form, and "219,00".
// Deliberately not a bare replace(/[^\d]/g,'') — that turns "219,00" into
// 21900, the exact 100x parse bug MAX_VALID_PRICE_NOK exists to catch.
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

const abs = (href) => { try { return new URL(href, BASE).toString(); } catch { return null; } };

async function getJson(url) {
  const res = await fetch(url, { headers: JSON_HEADERS, timeout: 15000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return JSON.parse(await res.text());
}

async function getHtml(url, referer) {
  const h = { ...HTML_HEADERS };
  if (referer) h.Referer = referer;
  const res = await fetch(url, { headers: h, timeout: 20000, follow: 5 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── Platform readers ─────────────────────────────────────────────────────────

async function readShopify() {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const url = `${BASE}/products.json?limit=250&page=${page}`;
    console.log(`  shopify p${page}: ${url}`);
    let json;
    try { json = await getJson(url); } catch (e) { console.log(`    ${e.message} — stop`); break; }
    const batch = json?.products || [];
    if (!batch.length) break;
    for (const p of batch) {
      const rawName = (p.title || '').trim();
      if (!keep(rawName) || isUsedProductMeta(p.product_type, p.tags)) continue;
      const v = (p.variants || []).find((x) => x.available) || (p.variants || [])[0];
      if (!v) continue;
      out.push({ rawName, price: parseNok(v.price), url: `${BASE}/products/${p.handle}`, inStock: !!v.available });
    }
    console.log(`    ${batch.length} raw (kept ${out.length})`);
    if (batch.length < 250) break;
    await sleep(1200);
  }
  return out;
}

async function readWoo() {
  const out = [];
  const skip = new Set(SKIP_CATEGORY_SLUGS);
  for (let page = 1; page <= 50; page++) {
    const url = `${BASE}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    console.log(`  woo p${page}: ${url}`);
    let batch;
    try { batch = await getJson(url); } catch (e) { console.log(`    ${e.message} — stop`); break; }
    if (!Array.isArray(batch) || !batch.length) break;
    for (const p of batch) {
      const rawName = (p.name || '').trim();
      if (!keep(rawName)) continue;
      if ((p.categories || []).some((c) => skip.has(c.slug))) continue;
      const unit = p.prices?.currency_minor_unit ?? 2;
      const price = p.prices?.price == null ? null : Math.round(Number(p.prices.price) / 10 ** unit);
      out.push({ rawName, price, url: p.permalink, inStock: p.is_in_stock !== false });
    }
    console.log(`    ${batch.length} raw (kept ${out.length})`);
    if (batch.length < 100) break;
    await sleep(1200);
  }
  return out;
}

// Mystore: product data sits inline in each card's Alpine.js
// `@click="... addToCart({ name: '...', price: '189,-', url: '...' })"`
// handler as a JS object literal (unquoted keys, single-quoted strings) —
// see scrape-frisbeebutikken.js's parseProductsFromHtml() for the full
// format explanation. This is a probe-local copy on purpose: if Mystore is
// what we find, the permanent version gets EXTRACTED to lib/mystore.js and
// shared by all three stores rather than copied a third time.
function parseMystore(html) {
  const out = [];
  const blockRe = /addToCart\(\{([\s\S]*?)\}\)/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const b = m[1];
    const name = b.match(/name:\s*'([^']*)'/);
    const price = b.match(/price:\s*'([^']*)'/);
    const url = b.match(/url:\s*'([^']*)'/);
    if (!name || !price || !url) continue;
    const rawName = name[1].trim();
    if (!keep(rawName)) continue;
    out.push({ rawName, price: parseNok(price[1]), url: abs(url[1]), inStock: true });
  }
  return out;
}

// The Mystore category slug is per-store and unguessable (Frisbeebutikken
// uses /categories/golfdisker, Starframe /categories/typer), so discover it
// from the homepage nav instead of hardcoding a third guess. Pagination is
// FOLLOWED from the markup's own <a href>s rather than constructed — the two
// existing Mystore scrapers use two different URL shapes, so there is no one
// shape to assume.
const HINTS = ['golfdisk', 'golfdisc', 'disker', 'discer', 'disk', 'disc', 'driver', 'putter', 'midrange', 'fairway', 'typer', 'frisbee'];

async function readMystore(home) {
  const $ = cheerio.load(home);

  const cats = new Map();
  $('a[href*="/categories/"]').each((_, el) => {
    const u = abs($(el).attr('href'));
    if (!u) return;
    const slug = (u.split('/categories/')[1] || '').toLowerCase();
    if (!slug || slug.includes('?')) return;
    if (SKIP_CATEGORY_SLUGS.some((s) => slug.includes(s))) return;
    const score = HINTS.reduce((a, k) => (slug.includes(k) ? a + 1 : a), 0);
    if (!cats.has(u) || cats.get(u) < score) cats.set(u, score);
  });

  const ranked = [...cats.entries()].sort((a, b) => b[1] - a[1]);
  const hinted = ranked.filter(([, s]) => s > 0).map(([u]) => u);
  console.log(`  ${cats.size} category links found, ${hinted.length} disc-related`);
  const queue = (hinted.length ? hinted : ranked.map(([u]) => u)).slice(0, 8);
  queue.forEach((u) => console.log(`    candidate: ${u}`));

  const out = [];
  const seen = new Set();
  const visited = new Set();

  for (const p of parseMystore(home)) {
    if (p.url && !seen.has(p.url)) { seen.add(p.url); out.push(p); }
  }
  console.log(`  homepage: ${out.length} products`);

  let fetched = 0;
  while (queue.length && fetched < 60) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    if (fetched) await sleep(2000 + Math.random() * 1000);
    let html;
    try { html = await getHtml(url, BASE); } catch (e) { console.warn(`  ⚠ ${url}: ${e.message}`); continue; }
    fetched++;
    const batch = parseMystore(html);
    let added = 0;
    for (const p of batch) {
      if (p.url && !seen.has(p.url)) { seen.add(p.url); out.push(p); added++; }
    }
    console.log(`  ${url} → ${batch.length} (${added} new, total ${out.length})`);
    if (batch.length) {
      const pg = cheerio.load(html);
      pg('a[href*="page="]').each((_, el) => {
        const href = pg(el).attr('href') || '';
        if (!/[?&]page=\d+/.test(href)) return;
        const u = abs(href);
        if (u && !visited.has(u) && !queue.includes(u)) queue.push(u);
      });
    }
  }
  return out;
}

// ── 50 kr price floor assertion ──────────────────────────────────────────────
// Per-product filter plus an aggregate assertion. The aggregate half is the
// real defense: a large SHARE of sub-50 kr prices is never a sale, it's a
// price-parse or currency bug (cf. the Discexpress USD-as-SEK incident,
// scrape-discexpress.js's assertSekStorefront).
const MAX_BELOW_FLOOR_SHARE = 0.30;

function priceGate(products) {
  const kept = [], below = [], above = [];
  for (const p of products) {
    if (p.price == null || isNaN(p.price)) continue;
    if (p.price < MIN_VALID_PRICE_NOK) { below.push(p); continue; }
    if (p.price > MAX_VALID_PRICE_NOK) { above.push(p); continue; }
    kept.push(p);
  }
  if (products.length >= 20 && below.length / products.length > MAX_BELOW_FLOOR_SHARE) {
    throw new Error(
      `Price floor assertion FAILED: ${below.length}/${products.length} ` +
      `(${Math.round((below.length / products.length) * 100)}%) below the ${MIN_VALID_PRICE_NOK} kr floor. ` +
      `That is a parse bug, not a sale. Samples: ` +
      below.slice(0, 5).map((p) => `"${p.rawName}"=${p.price}`).join(', ')
    );
  }
  console.log(`\n  Price gate: ${kept.length} kept | ${below.length} below ${MIN_VALID_PRICE_NOK} kr | ${above.length} above ${MAX_VALID_PRICE_NOK} kr`);
  if (below.length) console.log(`    below: ${below.slice(0, 5).map((p) => `"${p.rawName}"=${p.price}`).join(', ')}`);
  if (above.length) console.log(`    above: ${above.slice(0, 5).map((p) => `"${p.rawName}"=${p.price}`).join(', ')}`);
  return kept;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Krokhol probe — ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  // Reachability FIRST. Both JSON probes below infer "not this platform" from
  // a failed request, so without this check any blanket network failure (a
  // proxy denial, DNS, an outage) silently reports as "mystore" — which is
  // exactly what happened on the first run of this script from a sandbox with
  // no egress. Fail loudly and separately instead.
  let home;
  try {
    home = await getHtml(BASE, 'https://www.google.no/');
  } catch (err) {
    throw new Error(
      `Cannot reach ${BASE} (${err.message}). This is a connectivity problem, ` +
      `NOT a platform finding — run this from a machine with normal internet ` +
      `access before drawing any conclusion about the store.`
    );
  }
  console.log(`  ✓ ${BASE} reachable (${home.length} bytes)`);

  let platform = 'mystore';
  let products = [];

  console.log('Detecting platform...');
  try {
    const j = await getJson(`${BASE}/products.json?limit=1`);
    if (Array.isArray(j?.products)) platform = 'shopify';
  } catch { /* not Shopify */ }

  if (platform !== 'shopify') {
    try {
      const j = await getJson(`${BASE}/wp-json/wc/store/v1/products?per_page=1`);
      if (Array.isArray(j) && j.length && j[0].name != null) platform = 'woocommerce';
    } catch { /* not Woo */ }
  }

  console.log(`  → ${platform}\n`);

  if (platform === 'shopify') products = await readShopify();
  else if (platform === 'woocommerce') products = await readWoo();
  else products = await readMystore(home);

  if (!products.length) {
    throw new Error(
      `0 products via the ${platform} path. Platform detection may be wrong, or the ` +
      `listing markup differs. Dump a category page and inspect before adjusting.`
    );
  }

  products = priceGate(products);

  const matched = [], unmatched = [];
  for (const p of products) {
    const disc = matchDisc(p.rawName);
    if (disc) {
      const v = extractVariant(p.rawName, disc.brand);
      matched.push({ ...p, discId: disc.id, plastic: v.plastic, edition: v.edition });
    } else unmatched.push(p);
  }

  const rate = products.length ? (matched.length / products.length) * 100 : 0;
  const prices = products.map((p) => p.price).sort((a, b) => a - b);

  console.log('\n' + '='.repeat(60));
  console.log('KROKHOL PROBE RESULT (nothing written)');
  console.log('='.repeat(60));
  console.log(`Platform      : ${platform}`);
  console.log(`Products      : ${products.length}`);
  console.log(`Matched       : ${matched.length} (${rate.toFixed(1)}%)`);
  console.log(`Unique discs  : ${new Set(matched.map((m) => m.discId)).size}`);
  console.log(`Unmatched     : ${unmatched.length}`);
  if (prices.length) console.log(`Price range   : ${prices[0]}–${prices[prices.length - 1]} kr (median ${prices[Math.floor(prices.length / 2)]} kr)`);

  console.log('\n── 10 matched ' + '─'.repeat(46));
  matched.slice(0, 10).forEach((m) => {
    console.log(`  "${m.rawName}"`);
    console.log(`     → ${m.discId}  ${m.price} kr  [${m.plastic || 'no plastic'}${m.edition ? ', ' + m.edition : ''}]`);
  });

  console.log('\n── 5 unmatched ' + '─'.repeat(45));
  unmatched.slice(0, 5).forEach((u) => console.log(`  "${u.rawName}"  ${u.price} kr  ${u.url}`));

  console.log('\nNext step depends on the platform line above:');
  console.log('  shopify/woocommerce → add an ~8-line entry to scripts/scraper.js STORES');
  console.log('  mystore             → extract lib/mystore.js from frisbeebutikken+starframe,');
  console.log('                        then add Krokhol as config off it');
}

// Exported so the price parser and the floor assertion can be unit-tested
// without hitting the network (see probe-krokhol.test.js).
module.exports = { parseNok, priceGate };

if (require.main === module) {
  main().catch((err) => { console.error('\nFatal:', err.message); process.exit(1); });
}
