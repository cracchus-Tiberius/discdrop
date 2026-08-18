'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SIGNAL_WINDOW_MS,
  STORE_QUARANTINE_MS,
  MASS_RESET_THRESHOLD,
  findQuarantinedStores,
  findMassResetEvents,
  buildNewInStoresSignals,
  getIsoWeek,
  getIsoWeekStart,
  groupSignalsByWeek,
} = require('./new-in-stores');

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-17T07:00:00.000Z').getTime();
const CATALOG = [
  { id: 'innova-destroyer', name: 'Destroyer', brand: 'Innova', image: 'destroyer.jpg' },
  { id: 'mvp-photon', name: 'Photon', brand: 'MVP', image: '' },
];
const STORES = {
  a: { name: 'Store A' },
  b: { name: 'Store B' },
  c: { name: 'Store C', shipping: 45 },
};

function iso(msAgo) {
  return new Date(NOW - msAgo).toISOString();
}

// Store-onboarding age is derived from a store's OLDEST listing across the
// whole catalog (see findQuarantinedStores) — without at least one old
// anchor entry per store, a test fixture where every listing happens to be
// recent would make the store look brand new and quarantine it, which is
// correct behavior but not what most of these fixtures are testing. Mixed
// into every snapshot's prices below under a discId that's deliberately not
// in CATALOG, so it's invisible to signal generation but still counts for
// the quarantine baseline.
const ANCHOR = {
  '_anchor-disc': [
    { store: 'a', price: 100, inStock: true, plastic: 'X', firstSeen: iso(400 * DAY), url: 'a.no' },
    { store: 'b', price: 100, inStock: true, plastic: 'X', firstSeen: iso(400 * DAY), url: 'b.no' },
    { store: 'c', price: 100, inStock: true, plastic: 'X', firstSeen: iso(400 * DAY), url: 'c.no' },
  ],
};

test('findQuarantinedStores flags a store whose oldest listing is within the quarantine window', () => {
  const prices = {
    'innova-destroyer': [
      { store: 'a', firstSeen: iso(30 * DAY) }, // established
      { store: 'b', firstSeen: iso(5 * DAY) }, // brand new store
    ],
  };
  const quarantined = findQuarantinedStores(prices, NOW);
  assert.deepEqual([...quarantined], ['b']);
});

test('findQuarantinedStores is not fooled by one old listing at an otherwise-new store', () => {
  // Oldest listing decides — a single legacy-dated entry keeps a store out
  // of quarantine even if most of its catalog just appeared.
  const prices = {
    'innova-destroyer': [{ store: 'a', firstSeen: iso(25 * DAY) }],
    'mvp-photon': [{ store: 'a', firstSeen: iso(2 * DAY) }],
  };
  assert.equal(findQuarantinedStores(prices, NOW).size, 0);
});

test('buildNewInStoresSignals: disc with only recent entries everywhere -> new-disc', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'a.no' },
        { store: 'b', price: 210, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'b.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-disc');
  assert.equal(signals[0].discId, 'innova-destroyer');
  // 3 stores at the same disc/type in the same week merge into one entry.
  assert.equal(signals[0].stores.length, 2);
  assert.equal(signals[0].price, 200); // cheapest of the group
});

test('buildNewInStoresSignals: known disc, brand-new plastic at any store -> new-edition', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
        { store: 'b', price: 190, inStock: true, plastic: 'Champion', firstSeen: iso(3 * DAY), url: 'b.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-edition');
  assert.equal(signals[0].plastic, 'Champion');
});

test('buildNewInStoresSignals: known disc + known plastic, new store -> new-at-store', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
        { store: 'b', price: 195, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'b.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-at-store');
  assert.equal(signals[0].stores[0].store, 'b');
});

test('buildNewInStoresSignals: same disc can produce two distinct signals in one week', () => {
  // Store b's Champion plastic is new-edition; store c's Star plastic
  // (already known via store a) is new-at-store. Both fresh, both real news.
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
        { store: 'b', price: 220, inStock: true, plastic: 'Champion', firstSeen: iso(2 * DAY), url: 'b.no' },
        { store: 'c', price: 195, inStock: true, plastic: 'Star', firstSeen: iso(1 * DAY), url: 'c.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 2);
  const types = signals.map((s) => s.type).sort();
  assert.deepEqual(types, ['new-at-store', 'new-edition']);
});

test('buildNewInStoresSignals: entries older than the signal window produce nothing', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(SIGNAL_WINDOW_MS + DAY), url: 'a.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 0);
});

test('buildNewInStoresSignals: quarantined store generates no signal and is invisible as a baseline', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      'innova-destroyer': [
        // Store b is brand new (its only listing is 5 days old) -> quarantined.
        { store: 'b', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(5 * DAY), url: 'b.no' },
      ],
    },
  };
  const { signals, quarantinedStores } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 0);
  assert.deepEqual(quarantinedStores, ['b']);
});

test('buildNewInStoresSignals: price floor/ceiling and out-of-stock listings are excluded', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      'innova-destroyer': [
        { store: 'a', price: 10, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'a.no' }, // below floor
        { store: 'b', price: 9999, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'b.no' }, // above ceiling
        { store: 'c', price: 200, inStock: false, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'c.no' }, // out of stock
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 0);
});

test('buildNewInStoresSignals: discs missing from the catalog are skipped', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      'unknown-disc': [{ store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'a.no' }],
    },
  };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 0);
});

test('getIsoWeek: known reference dates', () => {
  // 2026-08-17 is a Monday.
  assert.deepEqual(getIsoWeek(new Date('2026-08-17T00:00:00.000Z')), { isoYear: 2026, weekNumber: 34 });
  // Year-boundary case: Dec 31 2025 is ISO week 1 of 2026 (Wednesday, week's
  // Thursday falls in January).
  assert.deepEqual(getIsoWeek(new Date('2025-12-31T00:00:00.000Z')), { isoYear: 2026, weekNumber: 1 });
});

test('getIsoWeekStart returns the Monday of the containing week', () => {
  const start = getIsoWeekStart(new Date('2026-08-19T15:30:00.000Z')); // a Wednesday
  assert.equal(start.toISOString().slice(0, 10), '2026-08-17');
});

test('groupSignalsByWeek buckets by ISO week and sorts newest week first', () => {
  const signals = [
    { discId: 'a', type: 'new-disc', firstSeenMs: new Date('2026-08-10T00:00:00.000Z').getTime() }, // week 33
    { discId: 'b', type: 'new-disc', firstSeenMs: new Date('2026-08-17T00:00:00.000Z').getTime() }, // week 34
  ];
  const weeks = groupSignalsByWeek(signals);
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].isoWeek, '2026-W34');
  assert.equal(weeks[0].startDate, '2026-08-17');
  assert.equal(weeks[0].endDate, '2026-08-23');
  assert.equal(weeks[1].isoWeek, '2026-W33');
});

// Sanity check the exported constants match what the rest of the site uses
// for "recent" (14 days) and the store-quarantine window (21 days).
test('window constants', () => {
  assert.equal(SIGNAL_WINDOW_MS, 14 * DAY);
  assert.equal(STORE_QUARANTINE_MS, 21 * DAY);
});

test('findMassResetEvents flags a store+date combo above the threshold', () => {
  const prices = {};
  // 31 listings at store 'a' on the same day -> over the default threshold of 30.
  for (let i = 0; i < 31; i++) {
    prices[`disc-${i}`] = [{ store: 'a', firstSeen: '2026-08-16T10:00:00.000Z' }];
  }
  const { keys, events } = findMassResetEvents(prices);
  assert.equal(keys.has('a|2026-08-16'), true);
  assert.deepEqual(events, [{ store: 'a', date: '2026-08-16', count: 31 }]);
});

test('findMassResetEvents does not flag a normal day of arrivals', () => {
  const prices = {};
  for (let i = 0; i < 5; i++) {
    prices[`disc-${i}`] = [{ store: 'a', firstSeen: '2026-08-16T10:00:00.000Z' }];
  }
  const { keys, events } = findMassResetEvents(prices);
  assert.equal(keys.size, 0);
  assert.deepEqual(events, []);
});

test('findMassResetEvents respects a custom threshold', () => {
  const prices = {};
  for (let i = 0; i < 5; i++) {
    prices[`disc-${i}`] = [{ store: 'a', firstSeen: '2026-08-16T10:00:00.000Z' }];
  }
  assert.equal(findMassResetEvents(prices, 4).keys.has('a|2026-08-16'), true);
  assert.equal(findMassResetEvents(prices, 10).keys.has('a|2026-08-16'), false);
});

test('buildNewInStoresSignals: a mass-reset churn event is suppressed entirely', () => {
  const prices = { ...ANCHOR };
  // 35 discs all "arriving" at store b on the same day -> churn event, not news.
  for (let i = 0; i < 35; i++) {
    prices[`churn-disc-${i}`] = [
      { store: 'b', price: 150, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'b.no' },
    ];
  }
  const catalog = [
    ...CATALOG,
    ...Array.from({ length: 35 }, (_, i) => ({ id: `churn-disc-${i}`, name: `Disc ${i}`, brand: 'Innova' })),
  ];
  const snapshot = { stores: STORES, prices };
  const { signals, massResetEvents } = buildNewInStoresSignals({ snapshot, catalog, asOfMs: NOW });
  assert.equal(signals.length, 0);
  assert.equal(massResetEvents.length, 1);
  assert.equal(massResetEvents[0].store, 'b');
  assert.equal(massResetEvents[0].count, 35);
});

test('buildNewInStoresSignals: mass-reset entries still count as baseline evidence a disc/plastic is established', () => {
  // Reproduces the Innova Destroyer bug found in production 2026-08-17: an
  // established disc where EVERY store's evidence of its age happens to
  // come from a mass-reset event (e.g. the day firstSeen tracking itself
  // was rolled out) must NOT be reclassified as "new-disc" just because
  // those entries are excluded from generating their OWN signals — they
  // still have to prove the disc isn't new.
  const prices = { ...ANCHOR };
  // 35 discs' worth of listings at store 'a', all reset on the same day
  // (e.g. a firstSeen-tracking rollout) -> mass-reset event for a|<date>.
  // innova-destroyer's own "Star" listing is one of those 35.
  prices['innova-destroyer'] = [
    { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
    // One isolated, genuinely fresh listing at a DIFFERENT store/date.
    { store: 'b', price: 199, inStock: true, plastic: 'Proto Glow', firstSeen: iso(3 * DAY), url: 'b.no' },
  ];
  for (let i = 0; i < 34; i++) {
    prices[`filler-disc-${i}`] = [
      { store: 'a', price: 150, inStock: true, plastic: 'DX', firstSeen: iso(60 * DAY), url: `filler-${i}.no` },
    ];
  }
  const catalog = [
    ...CATALOG,
    ...Array.from({ length: 34 }, (_, i) => ({ id: `filler-disc-${i}`, name: `Filler ${i}`, brand: 'Innova' })),
  ];
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog, asOfMs: NOW });
  assert.equal(signals.length, 1);
  // Must be new-edition (a new plastic on an established disc), NOT new-disc.
  assert.equal(signals[0].type, 'new-edition');
  assert.equal(signals[0].plastic, 'Proto Glow');
});

test('buildNewInStoresSignals: a mass-reset event at one store does not suppress a genuine arrival at another', () => {
  const prices = { ...ANCHOR };
  for (let i = 0; i < 35; i++) {
    prices[`churn-disc-${i}`] = [
      { store: 'b', price: 150, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'b.no' },
    ];
  }
  prices['innova-destroyer'] = [
    { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'a.no' },
  ];
  const catalog = [
    ...CATALOG,
    ...Array.from({ length: 35 }, (_, i) => ({ id: `churn-disc-${i}`, name: `Disc ${i}`, brand: 'Innova' })),
  ];
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].discId, 'innova-destroyer');
});
