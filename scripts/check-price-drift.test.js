'use strict';

// The median is the whole idea: real price movement is noisy and cancels;
// a conversion fault pushes every product the same way and survives.

const test = require('node:test');
const assert = require('node:assert');
const { median, sample } = require('./check-price-drift.js');

test('median ignores one product that moved on its own', () => {
  // Five products steady, one genuinely discounted 30%. No alert.
  assert.strictEqual(median([0, 0.4, -0.3, 0, -30, 0.2]), 0);
});

test('median survives a systematic conversion fault', () => {
  // The real Ugglans case: every sampled product low by roughly the same 4%.
  assert.ok(Math.abs(median([-4.1, -3.8, -4.0, -4.2, -3.9, -4.1])) > 2);
});

test('sample spreads across the catalogue rather than taking the first N', () => {
  // Taking the first N would sample one brand or one price band and miss a
  // fault confined elsewhere.
  const entries = Array.from({ length: 100 }, (_, i) => ({ url: `https://x/p${i}`, price: i + 1 }));
  const picked = sample(entries, 5);
  assert.strictEqual(picked.length, 5);
  assert.ok(picked[4].price - picked[0].price > 50, "samples should span the list");
});

test('sample skips entries with no usable URL or price', () => {
  assert.deepStrictEqual(
    sample([{ url: "", price: 10 }, { url: "https://x/a", price: 0 }, { url: "not-a-url", price: 5 }], 5),
    []
  );
});
