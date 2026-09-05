'use strict';

// The fallback is what these guard. The live path is a network call and is
// exercised by the scrapers themselves; the fallback is the path that ran
// silently wrong for months.

const test = require('node:test');
const assert = require('node:assert');
const { fxMeta, FALLBACK_SEK_NOK, MIN_PLAUSIBLE, MAX_PLAUSIBLE } = require('./fx.js');

test('the fallback rate is close to reality, not a stale round number', () => {
  // It was 1.03 across three scrapers and 1.00 in a fourth while the real rate
  // was 0.9724 — a ~6% overstatement of every Swedish price, in the stores'
  // favour, on a site that exists to say which store is cheapest.
  assert.ok(FALLBACK_SEK_NOK > 0.9 && FALLBACK_SEK_NOK < 1.05, `implausible fallback ${FALLBACK_SEK_NOK}`);
  assert.notStrictEqual(FALLBACK_SEK_NOK, 1.03);
});

test('the plausibility band would have caught a wrong base currency', () => {
  // The 2026-05-03 incident: a USD-priced storefront read as SEK produced
  // prices a tenth of reality. A rate outside this band is a broken response.
  assert.ok(MIN_PLAUSIBLE < FALLBACK_SEK_NOK && FALLBACK_SEK_NOK < MAX_PLAUSIBLE);
  assert.ok(MIN_PLAUSIBLE > 0.5 && MAX_PLAUSIBLE < 2);
});

test('fxMeta records the rate, where it came from, and when', () => {
  const at = '2026-09-05T10:00:00.000Z';
  assert.deepStrictEqual(fxMeta({ rate: 0.97236, source: 'live', fetchedAt: at }), {
    fxRate: 0.9724, fxRateSource: 'live', fxRateAt: at,
  });
});

test('a fallback run is recorded as a fallback, not passed off as live', () => {
  // Without this, a price that moved because the API was down is
  // indistinguishable from a real price change on /prisfall.
  const meta = fxMeta({ rate: FALLBACK_SEK_NOK, source: 'fallback', fetchedAt: '2026-09-05T10:00:00.000Z' });
  assert.strictEqual(meta.fxRateSource, 'fallback');
});
