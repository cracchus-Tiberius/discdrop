'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MIN_VALID_PRICE_NOK,
  entryLandedNOK,
  bestLandedEntry,
  pctChange,
  computeChanges,
  capPerBrand,
  buildHistory,
} = require('./price-changes');

test('entryLandedNOK adds shipping for non-NO stores, not for NO stores', () => {
  assert.equal(entryLandedNOK({ price: 100 }, { country: 'SE', shipping: 49 }), 149);
  assert.equal(entryLandedNOK({ price: 100 }, { country: 'NO', shipping: 79 }), 100);
  assert.equal(entryLandedNOK({ price: 100 }, undefined), 100);
  assert.equal(entryLandedNOK({ price: 100 }, { country: 'SE' }), 100); // missing shipping defaults to 0
});

test('bestLandedEntry picks cheapest in-stock landed price and ignores out-of-stock/invalid', () => {
  const storesMeta = {
    a: { name: 'Store A', country: 'NO' },
    b: { name: 'Store B', country: 'SE', shipping: 100 },
    c: { name: 'Store C', country: 'NO' },
  };
  const entries = [
    { store: 'a', price: 200, inStock: true },
    { store: 'b', price: 150, inStock: true }, // landed 250, more expensive after shipping
    { store: 'c', price: 190, inStock: false }, // cheaper but out of stock
  ];
  const best = bestLandedEntry(entries, storesMeta);
  assert.equal(best.store, 'a');
  assert.equal(best.landed, 200);
});

test('bestLandedEntry respects MIN_VALID_PRICE_NOK floor', () => {
  const storesMeta = { a: { country: 'NO' } };
  const entries = [{ store: 'a', price: MIN_VALID_PRICE_NOK - 1, inStock: true }];
  assert.equal(bestLandedEntry(entries, storesMeta), null);
});

test('bestLandedEntry returns null for empty/missing entries', () => {
  assert.equal(bestLandedEntry([], {}), null);
  assert.equal(bestLandedEntry(undefined, {}), null);
});

test('pctChange rounds and is negative for a drop', () => {
  assert.equal(pctChange(189, 149), -21);
  assert.equal(pctChange(100, 90), -10);
  assert.equal(pctChange(100, 110), 10);
});

test('computeChanges counts a disc once even if multiple stores changed', () => {
  const catalog = [{ id: 'disc-a', brand: 'BrandA' }];
  const storesMeta = { s1: { country: 'NO' }, s2: { country: 'NO' } };
  const oldSnapshot = {
    stores: storesMeta,
    prices: {
      'disc-a': [
        { store: 's1', price: 200, inStock: true },
        { store: 's2', price: 210, inStock: true },
      ],
    },
  };
  const newSnapshot = {
    generated: '2026-08-04T06:00:00Z',
    stores: storesMeta,
    prices: {
      'disc-a': [
        { store: 's1', price: 150, inStock: true }, // -25%
        { store: 's2', price: 160, inStock: true }, // also changed, same disc
      ],
    },
  };
  const { changedDiscCount, dropsRaw } = computeChanges({
    oldSnapshot,
    newSnapshot,
    catalog,
    period: 'day',
  });
  assert.equal(changedDiscCount, 1);
  assert.equal(dropsRaw.length, 1);
  assert.equal(dropsRaw[0].discId, 'disc-a');
  assert.equal(dropsRaw[0].oldPrice, 200);
  assert.equal(dropsRaw[0].newPrice, 150);
});

test('computeChanges counts newly-priced discs separately from changes, no pct emitted', () => {
  const catalog = [{ id: 'disc-new', brand: 'BrandA' }];
  const storesMeta = { s1: { country: 'NO' } };
  const oldSnapshot = { stores: storesMeta, prices: {} };
  const newSnapshot = {
    stores: storesMeta,
    prices: { 'disc-new': [{ store: 's1', price: 100, inStock: true }] },
  };
  const { changedDiscCount, newDiscCount, dropsRaw } = computeChanges({
    oldSnapshot,
    newSnapshot,
    catalog,
    period: 'day',
  });
  assert.equal(newDiscCount, 1);
  assert.equal(changedDiscCount, 0);
  assert.equal(dropsRaw.length, 0);
});

test('computeChanges ignores changes below the MIN_DROP_PCT threshold', () => {
  const catalog = [{ id: 'disc-a', brand: 'BrandA' }];
  const storesMeta = { s1: { country: 'NO' } };
  const oldSnapshot = { stores: storesMeta, prices: { 'disc-a': [{ store: 's1', price: 200, inStock: true }] } };
  const newSnapshot = { stores: storesMeta, prices: { 'disc-a': [{ store: 's1', price: 192, inStock: true }] } }; // -4%, -8kr: clears the noise gate, not the drop gate
  const { changedDiscCount, dropsRaw } = computeChanges({
    oldSnapshot,
    newSnapshot,
    catalog,
    period: 'day',
  });
  assert.equal(changedDiscCount, 1); // still a real price change...
  assert.equal(dropsRaw.length, 0); // ...but not a "prisfall" worth showing
});

test('computeChanges ignores currency-drift-sized noise: %-only or kr-only is not enough', () => {
  const catalog = [
    { id: 'disc-cheap', brand: 'BrandA' }, // 1kr on a cheap disc clears %, not kr
    { id: 'disc-pricey', brand: 'BrandB' }, // 10kr on an expensive disc clears kr, not %
  ];
  const storesMeta = { s1: { country: 'NO' } };
  const oldSnapshot = {
    stores: storesMeta,
    prices: {
      'disc-cheap': [{ store: 's1', price: 50, inStock: true }],
      'disc-pricey': [{ store: 's1', price: 1000, inStock: true }],
    },
  };
  const newSnapshot = {
    stores: storesMeta,
    prices: {
      'disc-cheap': [{ store: 's1', price: 49, inStock: true }], // -2%, -1kr
      'disc-pricey': [{ store: 's1', price: 990, inStock: true }], // -1%, -10kr
    },
  };
  const { changedDiscCount, dropsRaw } = computeChanges({
    oldSnapshot,
    newSnapshot,
    catalog,
    period: 'day',
  });
  assert.equal(changedDiscCount, 0);
  assert.equal(dropsRaw.length, 0);
});

test('computeChanges counts a change that clears both noise thresholds', () => {
  const catalog = [{ id: 'disc-a', brand: 'BrandA' }];
  const storesMeta = { s1: { country: 'NO' } };
  const oldSnapshot = { stores: storesMeta, prices: { 'disc-a': [{ store: 's1', price: 100, inStock: true }] } };
  const newSnapshot = { stores: storesMeta, prices: { 'disc-a': [{ store: 's1', price: 94, inStock: true }] } }; // -6%, -6kr
  const { changedDiscCount } = computeChanges({
    oldSnapshot,
    newSnapshot,
    catalog,
    period: 'day',
  });
  assert.equal(changedDiscCount, 1);
});

test('computeChanges sorts drops by pct ascending (biggest cut first)', () => {
  const catalog = [
    { id: 'disc-small', brand: 'BrandA' },
    { id: 'disc-big', brand: 'BrandB' },
  ];
  const storesMeta = { s1: { country: 'NO' } };
  const oldSnapshot = {
    stores: storesMeta,
    prices: {
      'disc-small': [{ store: 's1', price: 100, inStock: true }],
      'disc-big': [{ store: 's1', price: 100, inStock: true }],
    },
  };
  const newSnapshot = {
    stores: storesMeta,
    prices: {
      'disc-small': [{ store: 's1', price: 89, inStock: true }], // -11%
      'disc-big': [{ store: 's1', price: 60, inStock: true }], // -40%
    },
  };
  const { dropsRaw } = computeChanges({ oldSnapshot, newSnapshot, catalog, period: 'day' });
  assert.deepEqual(dropsRaw.map((d) => d.discId), ['disc-big', 'disc-small']);
});

test('capPerBrand keeps at most `max` per brand, preserving sort order', () => {
  const drops = [
    { discId: 'a1', brand: 'A', pct: -50 },
    { discId: 'a2', brand: 'A', pct: -40 },
    { discId: 'a3', brand: 'A', pct: -30 },
    { discId: 'b1', brand: 'B', pct: -20 },
  ];
  const kept = capPerBrand(drops, 2);
  assert.deepEqual(kept.map((d) => d.discId), ['a1', 'a2', 'b1']);
});

test('buildHistory returns targetLength points, oldest to newest', () => {
  const storesMeta = { s1: { country: 'NO' } };
  const snapshots = [100, 100, 95, 95, 90, 90, 80].map((price) => ({
    stores: storesMeta,
    prices: { 'disc-a': [{ store: 's1', price, inStock: true }] },
  }));
  const history = buildHistory('disc-a', snapshots, 7);
  assert.deepEqual(history, [100, 100, 95, 95, 90, 90, 80]);
});

test('buildHistory backfills leading gaps and pads short windows', () => {
  const storesMeta = { s1: { country: 'NO' } };
  const snapshots = [
    { stores: storesMeta, prices: {} }, // no price yet
    { stores: storesMeta, prices: { 'disc-a': [{ store: 's1', price: 120, inStock: true }] } },
    { stores: storesMeta, prices: { 'disc-a': [{ store: 's1', price: 100, inStock: true }] } },
  ];
  const history = buildHistory('disc-a', snapshots, 7);
  assert.equal(history.length, 7);
  assert.deepEqual(history, [120, 120, 120, 120, 120, 120, 100]);
});

test('buildHistory returns null when a disc never had a price in the window', () => {
  const snapshots = [{ stores: {}, prices: {} }, { stores: {}, prices: {} }];
  assert.equal(buildHistory('disc-a', snapshots, 7), null);
});
