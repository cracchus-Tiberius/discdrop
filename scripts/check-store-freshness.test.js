'use strict';

// Offline tests for the per-store staleness check. The scenario each one
// encodes is the Aceshop failure of 2026-09-01..05: one store dead, the
// dataset as a whole still fresh, every existing signal green.

const test = require('node:test');
const assert = require('node:assert');
const { checkStoreFreshness } = require('./check-store-freshness.js');

const NOW = Date.parse('2026-09-05T12:00:00.000Z');
const hoursAgo = (h) => new Date(NOW - h * 3_600_000).toISOString();

const snapshot = (perStoreAgeHours) => ({
  stores: Object.fromEntries(Object.keys(perStoreAgeHours).map((k) => [k, { name: k }])),
  prices: {
    'innova-destroyer': Object.entries(perStoreAgeHours)
      .filter(([, h]) => h != null)
      .map(([store, h]) => ({ store, price: 249, lastScraped: hoursAgo(h) })),
  },
});

test('a single stale store is caught while the rest are fresh', () => {
  // Exactly the Aceshop case: 18 stores fine, one 94 hours old.
  const { stale } = checkStoreFreshness(snapshot({ aceshop: 94, nydisk: 17, discsport: 1 }), { nowMs: NOW });
  assert.deepStrictEqual(stale.map((r) => r.store), ['aceshop']);
});

test('all stores fresh reports nothing stale', () => {
  const { stale } = checkStoreFreshness(snapshot({ aceshop: 17, nydisk: 17, discsport: 1 }), { nowMs: NOW });
  assert.deepStrictEqual(stale, []);
});

test('36h is the boundary, and one late run does not trip it', () => {
  // GitHub's scheduler has run hours late before; 25h must stay green.
  assert.deepStrictEqual(checkStoreFreshness(snapshot({ a: 25 }), { nowMs: NOW }).stale, []);
  assert.deepStrictEqual(checkStoreFreshness(snapshot({ a: 35.9 }), { nowMs: NOW }).stale, []);
  assert.deepStrictEqual(
    checkStoreFreshness(snapshot({ a: 36.1 }), { nowMs: NOW }).stale.map((r) => r.store), ['a']);
});

test('a store with no priced listings at all is stale, not skipped', () => {
  // A scraper that returns zero products leaves its store key in the stores
  // block with nothing under it. Treating that as "no data, no opinion" is how
  // a dead scraper stays invisible.
  const { stale } = checkStoreFreshness(snapshot({ aceshop: null, nydisk: 2 }), { nowMs: NOW });
  assert.deepStrictEqual(stale.map((r) => r.store), ['aceshop']);
  assert.strictEqual(stale[0].ageHours, Infinity);
});

test('the threshold is configurable', () => {
  assert.deepStrictEqual(
    checkStoreFreshness(snapshot({ a: 20 }), { nowMs: NOW, maxAgeHours: 12 }).stale.map((r) => r.store), ['a']);
});

// ── Known-blocked stores ────────────────────────────────────────────────────
// The Discsport case of 2026-09-08 onward: a store that will never come back
// on its own, failing the run every day until a red pipeline was just the
// normal state of things.

const BLOCKED = { discsport: { since: '2026-09-08', reason: 'reCAPTCHA for datacenter IPs' } };

test('a known-blocked store is reported but does not fail the run', () => {
  const r = checkStoreFreshness(snapshot({ discsport: 1005, nydisk: 2 }), {
    nowMs: NOW,
    knownBlocked: BLOCKED,
  });
  assert.deepStrictEqual(r.blocked.map((x) => x.store), ['discsport']);
  assert.deepStrictEqual(r.unexpected, []);
  // Still stale in the plain sense — we have not stopped measuring it.
  assert.deepStrictEqual(r.stale.map((x) => x.store), ['discsport']);
});

test('a genuinely dead store is still caught while a blocked one is excused', () => {
  // The failure mode being guarded against: silencing Discsport must not
  // silence the next Aceshop.
  const r = checkStoreFreshness(snapshot({ discsport: 1005, aceshop: 94, nydisk: 2 }), {
    nowMs: NOW,
    knownBlocked: BLOCKED,
  });
  assert.deepStrictEqual(r.unexpected.map((x) => x.store), ['aceshop']);
  assert.deepStrictEqual(r.blocked.map((x) => x.store), ['discsport']);
});

test('a blocked store that starts answering again is flagged for delisting', () => {
  const r = checkStoreFreshness(snapshot({ discsport: 2, nydisk: 2 }), {
    nowMs: NOW,
    knownBlocked: BLOCKED,
  });
  assert.deepStrictEqual(r.recovered.map((x) => x.store), ['discsport']);
  assert.deepStrictEqual(r.unexpected, []);
});

test('with no blocked list every stale store is unexpected', () => {
  const r = checkStoreFreshness(snapshot({ discsport: 1005, aceshop: 94 }), {
    nowMs: NOW,
    knownBlocked: {},
  });
  assert.deepStrictEqual(r.unexpected.map((x) => x.store).sort(), ['aceshop', 'discsport']);
  assert.deepStrictEqual(r.blocked, []);
});
