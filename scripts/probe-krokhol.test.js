'use strict';

// Tests for scripts/probe-krokhol.js's two pieces of real logic: the
// Norwegian price parser and the 50 kr floor assertion. Both run offline.
// Delete alongside probe-krokhol.js once Krokhol is wired into the pipeline
// (its parser/assertion move to the permanent implementation).

const test = require('node:test');
const assert = require('node:assert');
const { parseNok, priceGate } = require('./probe-krokhol.js');

test('parseNok handles the Mystore "189,-" form', () => {
  assert.strictEqual(parseNok('189,-'), 189);
  assert.strictEqual(parseNok('249,-'), 249);
});

test('parseNok handles thousands with a space separator', () => {
  assert.strictEqual(parseNok('1 025,-'), 1025);
});

test('parseNok treats a trailing ,00 as decimals, not digits', () => {
  // The naive replace(/[^\d]/g,'') this codebase uses elsewhere returns
  // 21900 here — a 100x error that would sail past the 50 kr floor and get
  // caught only by the 600 kr ceiling.
  assert.strictEqual(parseNok('219,00'), 219);
  assert.strictEqual(parseNok('39,00'), 39);
  assert.strictEqual(parseNok('248,75'), 249);
});

test('parseNok returns null for junk', () => {
  assert.strictEqual(parseNok(null), null);
  assert.strictEqual(parseNok('Utsolgt'), null);
});

test('priceGate drops entries below the 50 kr floor and above the 600 kr ceiling', () => {
  const kept = priceGate([
    { rawName: 'Champion Caiman', price: 219 },
    { rawName: 'Mini marker', price: 25 },
    { rawName: 'Basket', price: 4500 },
    { rawName: 'Star Destroyer', price: 249 },
  ]);
  assert.deepStrictEqual(kept.map((p) => p.price), [219, 249]);
});

test('priceGate throws when a large share of prices fall below the floor', () => {
  // 25 products, 15 of them sub-50 — the signature of a parse/currency bug.
  const products = [
    ...Array.from({ length: 15 }, (_, i) => ({ rawName: `broken ${i}`, price: 21 })),
    ...Array.from({ length: 10 }, (_, i) => ({ rawName: `ok ${i}`, price: 229 })),
  ];
  assert.throws(() => priceGate(products), /Price floor assertion FAILED/);
});

test('priceGate does not throw on a small sample below the assertion threshold', () => {
  // Under 20 products there is not enough signal to call it a bug.
  const products = [
    { rawName: 'cheap', price: 20 },
    { rawName: 'ok', price: 229 },
  ];
  assert.doesNotThrow(() => priceGate(products));
});
