// scripts/scrape-discsport.js — scraper for discsport.se (custom platform)
// Platform: custom Angular/server-rendered — requires Playwright
// Currency: SEK → converted to NOK with live rate (~1:1)
// Shipping to Norway: 39 SEK ≈ 40 NOK — VOEC registered (MVA inkl.)
// Usage: node scripts/scrape-discsport.js  or  pnpm scrape:discsport
'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { matchDisc, extractVariant, isUsedDisc, isMiniDisc, isNonDiscProduct } = require('./stores.config.js');

const STORE = {
  key: 'discsport',
  name: 'Discsport',
  baseUrl: 'https://discsport.se',
  shipping: 40, // 39 SEK ≈ 40 NOK
  country: 'SE',
  voec: true,
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── SEK → NOK rate ────────────────────────────────────────────────────────────

async function fetchSekToNok() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/SEK', { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rate = data?.rates?.NOK;
    if (rate && rate > 0) {
      console.log(`  SEK/NOK rate: ${rate.toFixed(4)}`);
      return rate;
    }
  } catch (err) {
    console.log(`  Could not fetch live rate (${err.message}), using 1.03`);
  }
  return 1.03; // fallback: 1 SEK ≈ 1.03 NOK
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Parse "229:-", "149:-", "1 299:-" → integer SEK
function parseSekPrice(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/\s/g, '').replace(':-', '').replace(/[^0-9]/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

// Swedish disc type keywords to find where name ends
const TYPE_KEYWORDS = ['Distance Driver', 'Fairway Driver', 'Midrange', 'Putt', 'Approach'];
// Labels that appear before the product name
const SKIP_LABELS = ['Slutsåld', 'Bästsäljare', 'Nyhet', 'Kampanj', 'Rea', 'Ny'];

function extractNameFromColText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const nameLines = [];
  let pastLabels = false;

  for (const line of lines) {
    // Skip pure numbers (rankings like "14")
    if (/^\d+$/.test(line)) continue;
    // Skip price lines
    if (/^\d[\d\s]*:-$/.test(line)) break;
    // Skip known labels before name
    if (!pastLabels && SKIP_LABELS.some(l => line.startsWith(l))) continue;
    // Stop at disc type
    if (TYPE_KEYWORDS.some(kw => line.startsWith(kw))) break;
    // Stop at single-letter stock codes ("A", "B", "N")
    if (/^[A-Z]$/.test(line) && pastLabels) break;

    pastLabels = true;
    nameLines.push(line);
  }

  return nameLines.join(' ').trim();
}

// ── Scraper ───────────────────────────────────────────────────────────────────

async function scrape() {
  let playwright, browser;
  try {
    playwright = require('playwright');
  } catch {
    console.error('Playwright not installed. Run: npx playwright install chromium');
    process.exit(1);
  }

  browser = await playwright.chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'sv-SE',
    extraHTTPHeaders: { 'Accept-Language': 'sv;q=0.9,en;q=0.7' },
  });

  try {
    // ── Step 1: Extract mold slugs from autocomplete on the main disc page ──────
    console.log('  Loading disc catalogue page to extract mold slugs...');
    const indexPage = await context.newPage();
    indexPage.on('dialog', d => d.dismiss().catch(() => {}));

    // Use the Swedish path — /no/ prefix breaks mold page filtering
    await indexPage.goto(`${STORE.baseUrl}/discar`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Format: " Destroyer##15##2##discar/mold/destroyer "
    const moldSlugs = await indexPage.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const slugs = new Set();
      for (const script of scripts) {
        const text = script.textContent || '';
        const matches = text.matchAll(/"[^"]*##\d+##2##discar\/mold\/([^"\s]+)[^"]*"/g);
        for (const m of matches) {
          const moldSlug = m[1];
          if (moldSlug && moldSlug.length > 1) slugs.add(moldSlug);
        }
      }
      return [...slugs];
    });

    await indexPage.close();
    console.log(`  Found ${moldSlugs.length} disc mold slugs`);

    if (moldSlugs.length === 0) {
      console.error('  No mold slugs found — site structure may have changed');
      return [];
    }

    // ── Step 2: Visit each mold page and scrape variant prices ────────────────
    const allProducts = [];
    const seenKeys = new Set();

    for (let i = 0; i < moldSlugs.length; i++) {
      const slug = moldSlugs[i];
      // Use Swedish URL — /no/ prefix shows wrong discs on mold pages
      const url = `${STORE.baseUrl}/discar/mold/${slug}`;

      if ((i + 1) % 20 === 0 || i === 0) {
        console.log(`  Scraping mold ${i + 1}/${moldSlugs.length}: ${slug}`);
      }

      const page = await context.newPage();
      try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Products are in .col children of the Bootstrap row grid
        const products = await page.evaluate(() => {
          const results = [];
          const grid = document.querySelector('.row.row-cols-2');
          if (!grid) return results;

          const cols = grid.querySelectorAll(':scope > .col');
          for (const col of cols) {
            const text = col.innerText || '';
            const rawPrice = (text.match(/(\d[\d\s]*):- *$/) || text.match(/(\d[\d\s]*):-/))?.[0] || '';
            if (!rawPrice) continue;

            const inStock = !text.includes('Slutsåld');
            results.push({ colText: text, rawPrice, inStock });
          }
          return results;
        });

        for (const p of products) {
          const rawName = extractNameFromColText(p.colText);
          if (!rawName) continue;

          const key = `${rawName}|${slug}`;
          if (seenKeys.has(key)) continue;
          if (isUsedDisc(rawName) || isMiniDisc(rawName) || isNonDiscProduct(rawName)) continue;

          const sekPrice = parseSekPrice(p.rawPrice);
          if (!sekPrice || sekPrice < 50) continue; // skip accessories

          seenKeys.add(key);
          allProducts.push({
            rawName,
            price: sekPrice,
            productUrl: url,
            inStock: p.inStock,
          });
        }

        // Polite delay — networkidle already waits, keep short
        await new Promise(r => setTimeout(r, 200 + Math.random() * 150));
      } catch (err) {
        if (!err.message.includes('Timeout') || i % 50 === 0) {
          console.warn(`    ⚠ ${slug}: ${err.message}`);
        }
      } finally {
        await page.close();
      }
    }

    console.log(`  Scraped ${allProducts.length} products from ${moldSlugs.length} mold pages`);
    return allProducts;
  } finally {
    await browser.close();
  }
}

// ── Merge results ─────────────────────────────────────────────────────────────

function mergeResults(products, sekToNok, now) {
  const dataPath = path.join(__dirname, '..', 'data', 'scraped-prices.json');
  let existing = { lastUpdated: now, stores: {}, prices: {} };
  if (fs.existsSync(dataPath)) {
    try { existing = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch {}
  }

  existing.stores[STORE.key] = {
    name: STORE.name,
    url: STORE.baseUrl,
    shipping: STORE.shipping,
    country: STORE.country,
    voec: STORE.voec,
  };

  // Remove stale entries for this store
  for (const discId of Object.keys(existing.prices)) {
    existing.prices[discId] = existing.prices[discId].filter(e => e.store !== STORE.key);
    if (existing.prices[discId].length === 0) delete existing.prices[discId];
  }

  let matched = 0;
  const unmatched = [];

  for (const product of products) {
    const disc = matchDisc(product.rawName);
    if (disc) {
      if (!existing.prices[disc.id]) existing.prices[disc.id] = [];
      const variant = extractVariant(product.rawName, disc.brand);
      const priceNOK = Math.round(product.price * sekToNok);

      const dupe = existing.prices[disc.id].find(e => e.store === STORE.key && e.plastic === variant.plastic);
      if (!dupe) {
        existing.prices[disc.id].push({
          store: STORE.key,
          price: priceNOK,
          inStock: product.inStock,
          url: product.productUrl,
          image: null,
          plastic: variant.plastic,
          edition: variant.edition,
          lastScraped: now,
        });
      } else if (priceNOK < dupe.price) {
        Object.assign(dupe, { price: priceNOK, inStock: product.inStock, url: product.productUrl, lastScraped: now });
      }
      matched++;
    } else {
      unmatched.push({ store: STORE.key, rawName: product.rawName, price: product.price, url: product.productUrl });
    }
  }

  existing.lastUpdated = now;
  fs.writeFileSync(dataPath, JSON.stringify(existing, null, 2));
  console.log(`✓ Wrote ${dataPath}`);

  const unmatchedPath = path.join(__dirname, '..', 'data', 'unmatched-products.json');
  let unmatchedFile = { lastUpdated: now, products: [] };
  if (fs.existsSync(unmatchedPath)) { try { unmatchedFile = JSON.parse(fs.readFileSync(unmatchedPath, 'utf8')); } catch {} }
  unmatchedFile.products = unmatchedFile.products.filter(p => p.store !== STORE.key);
  unmatchedFile.products.push(...unmatched);
  unmatchedFile.lastUpdated = now;
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatchedFile, null, 2));

  return { matched, unmatched: unmatched.length, total: products.length };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  console.log(`Discsport scraper — ${now}`);
  console.log('='.repeat(50));

  const sekToNok = await fetchSekToNok();
  const products = await scrape();

  if (products.length === 0) {
    console.error('No products scraped — check selectors or site structure');
    process.exit(1);
  }

  const { matched, unmatched, total } = mergeResults(products, sekToNok, now);
  console.log(`  Matched ${matched} discs, ${unmatched} unmatched (${total} total)`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
