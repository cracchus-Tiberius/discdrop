'use strict';

// scripts/check-price-drift.js — do our recorded prices still match the shops'?
//
// Found by hand on 2026-09-05, which is the problem. Ugglans' scraper pinned
// ?currency=SEK on its Shopify endpoint. That parameter did not pin the price;
// it triggered a conversion from another base currency without the shop's own
// rounding, so every Ugglans price we published was about 4% below what the
// customer actually pays. It took someone comparing six listings against the
// live store to see it, and only because they went looking.
//
// The tell was not any single price — those move on their own — it was that
// ALL SIX were low by the same ~4%. A conversion error is systematic. Real
// price movement is not. So this samples several products per store and looks
// at the MEDIAN gap: individual noise cancels, a systematic error does not.
//
// Catches the whole class, in both directions, for every Shopify store: a
// wrong currency parameter, a stale exchange rate, a scraper reading a sale
// price where the shop shows a regular one, or the reverse.
//
// Usage: node scripts/check-price-drift.js [--samples=8] [--max-drift=2]

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const UA = 'DiscDrop price-drift check (+https://discdrop.net)';
const DEFAULT_SAMPLES = 8;
// A conversion bug shows up as several percent across the board. 2% leaves
// room for ordinary rounding and the odd price that moved between runs.
const DEFAULT_MAX_DRIFT_PCT = 2;
// Below this many usable comparisons a median means nothing, so the store is
// reported as unchecked rather than passed or failed.
const MIN_SAMPLES_FOR_VERDICT = 4;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (name, fallback) => {
  const f = process.argv.find((a) => a.startsWith(`--${name}=`));
  return f ? Number(f.slice(name.length + 3)) : fallback;
};

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Shopify exposes any product as <product-url>.json. Non-Shopify stores just 404. */
async function livePrice(productUrl) {
  const url = productUrl.replace(/[?#].*$/, '').replace(/\/$/, '') + '.json';
  const res = await fetch(url, { headers: { 'User-Agent': UA }, timeout: 12000 });
  if (!res.ok) return null;
  const product = (await res.json())?.product;
  if (!product?.variants?.length) return null;
  // Prefer what a buyer can actually order; fall back to any variant so a
  // temporarily sold-out product still contributes.
  const pool = product.variants.filter((v) => v.available);
  const prices = (pool.length ? pool : product.variants).map((v) => parseFloat(v.price)).filter((n) => n > 0);
  return prices.length ? Math.min(...prices) : null;
}

function sample(entries, n) {
  const withUrls = entries.filter((e) => /^https?:\/\//.test(e.url || '') && e.price > 0);
  const out = [];
  const step = Math.max(1, Math.floor(withUrls.length / n));
  for (let i = 0; i < withUrls.length && out.length < n; i += step) out.push(withUrls[i]);
  return out;
}

async function main() {
  const samples = arg('samples', DEFAULT_SAMPLES);
  const maxDrift = arg('max-drift', DEFAULT_MAX_DRIFT_PCT);
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'scraped-prices.json'), 'utf8')
  );

  const byStore = new Map();
  for (const entries of Object.values(snapshot.prices || {})) {
    for (const e of entries) {
      if (!byStore.has(e.store)) byStore.set(e.store, []);
      byStore.get(e.store).push(e);
    }
  }

  let failed = 0;
  const unchecked = [];

  for (const [store, entries] of [...byStore.entries()].sort()) {
    const meta = (snapshot.stores || {})[store] || {};
    // A foreign store's price has to be put back through the rate its run
    // recorded before it can be compared with what the shop charges. Without
    // that rate there is nothing to compare against: assuming 1 turns the
    // exchange rate itself into apparent drift, which is exactly how this
    // check first accused Discexpress of a 2.8% fault that was really just
    // 0.9724 misread as parity.
    if (meta.currency && meta.currency !== 'NOK' && meta.fxRate == null) {
      unchecked.push(`${store} (foreign currency, no fxRate recorded yet)`);
      continue;
    }
    const rate = meta.fxRate ?? 1;
    const drifts = [];

    for (const entry of sample(entries, samples)) {
      let live = null;
      try { live = await livePrice(entry.url); } catch { /* unreachable, skip */ }
      await sleep(400);
      if (live == null) continue;
      const expected = Math.round(live * rate);
      if (expected <= 0) continue;
      drifts.push(((entry.price - expected) / expected) * 100);
    }

    if (drifts.length < MIN_SAMPLES_FOR_VERDICT) {
      unchecked.push(`${store} (${drifts.length} usable samples)`);
      continue;
    }

    const med = median(drifts);
    const ok = Math.abs(med) <= maxDrift;
    if (!ok) failed++;
    console.log(
      `  ${ok ? '  ok ' : 'DRIFT'}  ${store.padEnd(18)} median ${med >= 0 ? '+' : ''}${med.toFixed(1)}%  ` +
      `over ${drifts.length} samples${rate !== 1 ? `  (fxRate ${rate})` : ''}`
    );
    if (!ok) {
      console.log(
        `::error title=Price drift: ${store}::Our recorded prices sit ${med.toFixed(1)}% from what ${store} ` +
        `currently charges, across ${drifts.length} sampled products. A gap this consistent is a conversion or ` +
        `parsing fault, not price movement — real movement does not push every product the same way. ` +
        `Check that store's scraper for a currency parameter, a stale rate, or the wrong price field.`
      );
    }
  }

  if (unchecked.length) {
    console.log(`\n  not checked (no Shopify product JSON): ${unchecked.join(', ')}`);
  }
  if (failed) {
    console.log(`::error::${failed} store(s) drifted more than ${maxDrift}% from their own prices.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll checked stores within ${maxDrift}% of their own current prices.`);
  }
}

module.exports = { median, sample };

if (require.main === module) {
  main().catch((err) => { console.error('\nFatal:', err.message); process.exit(1); });
}
