'use strict';

// The two resets below are not hypothetical: on 2026-11-23 they gave ~130
// listings a day a fresh firstSeen (see first-seen-ledger.js's header).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ledgerKey,
  earliest,
  resolveFirstSeen,
  recordSeen,
  pruneLedger,
  loadLedger,
  saveLedger,
  LEDGER_RETENTION_DAYS,
} = require('./first-seen-ledger.js');
const { mergeStoreResults } = require('../stores.config.js');

const D1 = '2026-11-01T04:30:00.000Z';
const D2 = '2026-11-02T04:30:00.000Z';
const D3 = '2026-11-03T04:30:00.000Z';
const D4 = '2026-11-04T04:30:00.000Z';

test('earliest skips missing values', () => {
  assert.strictEqual(earliest(undefined, D2, null, D1), D1);
  assert.strictEqual(earliest(undefined, null), undefined);
});

test('resolveFirstSeen takes the earliest of ledger and snapshot, else now', () => {
  const ledger = { entries: { [ledgerKey('d', 's', 'u')]: { f: D1, l: D2 } } };
  assert.strictEqual(resolveFirstSeen({ ledger, discId: 'd', store: 's', url: 'u', keyFirstSeen: D2, now: D3 }), D1);
  assert.strictEqual(resolveFirstSeen({ ledger, discId: 'd', store: 's', url: 'other', keyFirstSeen: D2, now: D3 }), D2);
  assert.strictEqual(resolveFirstSeen({ ledger, discId: 'd', store: 's', url: 'other', now: D3 }), D3);
});

test('a URL carries its date only within its own disc and store', () => {
  // A listing the matcher moves to another disc is not that disc's old news.
  const ledger = { entries: { [ledgerKey('d', 's', 'u')]: { f: D1, l: D2 } } };
  assert.strictEqual(resolveFirstSeen({ ledger, discId: 'other', store: 's', url: 'u', now: D3 }), D3);
  assert.strictEqual(resolveFirstSeen({ ledger, discId: 'd', store: 'other', url: 'u', now: D3 }), D3);
});

test('a renamed disc id finds its old URL through the alias', () => {
  const ledger = { entries: { [ledgerKey('old-id', 's', 'u')]: { f: D1, l: D2 } } };
  assert.strictEqual(resolveFirstSeen({ ledger, discId: 'new-id', aliasId: 'old-id', store: 's', url: 'u', now: D3 }), D1);
});

test('recordSeen never moves firstSeen later and always moves lastSeen forward', () => {
  const ledger = { entries: {} };
  recordSeen(ledger, { discId: 'd', store: 's', url: 'u', firstSeen: D2, now: D2 });
  recordSeen(ledger, { discId: 'd', store: 's', url: 'u', firstSeen: D3, now: D3 });
  assert.deepStrictEqual(ledger.entries[ledgerKey('d', 's', 'u')], { f: D2, l: D3 });
  recordSeen(ledger, { discId: 'd', store: 's', url: 'u', firstSeen: D1, now: D4 });
  assert.deepStrictEqual(ledger.entries[ledgerKey('d', 's', 'u')], { f: D1, l: D4 });
});

test('pruneLedger forgets listings unseen for the retention period, and only those', () => {
  const now = '2026-12-31T04:30:00.000Z';
  const justInside = new Date(new Date(now).getTime() - (LEDGER_RETENTION_DAYS - 1) * 864e5).toISOString();
  const ledger = { entries: { old: { f: D1, l: '2026-10-01T04:30:00.000Z' }, recent: { f: D1, l: justInside } } };
  assert.strictEqual(pruneLedger(ledger, now), 1);
  assert.deepStrictEqual(Object.keys(ledger.entries), ['recent']);
});

test('loadLedger survives a missing or corrupt file; saveLedger round-trips', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-'));
  const p = path.join(dir, 'l.json');
  assert.deepStrictEqual(loadLedger(p), { entries: {} });
  fs.writeFileSync(p, '{not json');
  assert.deepStrictEqual(loadLedger(p), { entries: {} });
  saveLedger(p, { entries: { b: { f: D1, l: D2 }, a: { f: D1, l: D2 } } });
  const back = loadLedger(p);
  assert.deepStrictEqual(Object.keys(back.entries), ['a', 'b']);
});

// ── End to end through mergeStoreResults ────────────────────────────────

function tmpDataDir(prices) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-'));
  fs.writeFileSync(path.join(dir, 'scraped-prices.json'), JSON.stringify({ lastUpdated: D1, stores: {}, prices }));
  return dir;
}
const read = (dir) => JSON.parse(fs.readFileSync(path.join(dir, 'scraped-prices.json'), 'utf8')).prices;
const merge = (dir, products, now) =>
  mergeStoreResults({ products, storeKeys: ['teststore'], storeMeta: { teststore: { name: 'Test' } }, now, dataDir: dir });

const BERG_URL = 'https://example.test/products/k3-hard-berg';
const berg = { store: 'teststore', rawName: 'Kastaplast Berg', price: 199, inStock: true, productUrl: BERG_URL };
const aviar = { store: 'teststore', rawName: 'Innova DX Aviar', price: 149, inStock: true, productUrl: 'https://example.test/dx-aviar' };

test('a plastic filled in after the merge no longer resets firstSeen', () => {
  // Day 1: the title names no plastic, so the merge stores plastic=null…
  const dir = tmpDataDir({});
  merge(dir, [berg], D1);
  // …and enrich-variants.js fills it in from the slug afterwards.
  const p = read(dir);
  assert.strictEqual(p['kastaplast-berg'][0].plastic, null);
  p['kastaplast-berg'][0].plastic = 'K3 Hard';
  fs.writeFileSync(path.join(dir, 'scraped-prices.json'), JSON.stringify({ lastUpdated: D1, stores: {}, prices: p }));
  // Day 2: the merge looks up "…|null" again. It used to find nothing.
  merge(dir, [berg], D2);
  assert.strictEqual(read(dir)['kastaplast-berg'][0].firstSeen, D1);
});

test('a listing missing from one run keeps its firstSeen when it comes back', () => {
  const dir = tmpDataDir({});
  merge(dir, [berg, aviar], D1);
  merge(dir, [aviar], D2); // Berg not reached this run
  assert.strictEqual(read(dir)['kastaplast-berg'], undefined);
  merge(dir, [berg, aviar], D3);
  assert.strictEqual(read(dir)['kastaplast-berg'][0].firstSeen, D1);
});

test('a genuinely new listing is still first seen today', () => {
  const dir = tmpDataDir({});
  merge(dir, [aviar], D1);
  merge(dir, [aviar, berg], D2);
  assert.strictEqual(read(dir)['kastaplast-berg'][0].firstSeen, D2);
  assert.strictEqual(read(dir)['innova-aviar'][0].firstSeen, D1);
});

test('two listings collapsing into one entry keep the earlier date', () => {
  const dir = tmpDataDir({});
  merge(dir, [aviar], D1);
  const cheaperNewUrl = { ...aviar, price: 129, productUrl: 'https://example.test/dx-aviar-2' };
  merge(dir, [cheaperNewUrl, aviar], D2);
  const e = read(dir)['innova-aviar'];
  assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].price, 129);
  assert.strictEqual(e[0].firstSeen, D1);
});
