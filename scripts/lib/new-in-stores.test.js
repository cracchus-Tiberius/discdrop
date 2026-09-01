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
  isoWeekKey,
  groupSignalsByWeek,
  partitionWeeksForFreezing,
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

test('buildNewInStoresSignals: disc already in the catalog, delisted then restocked -> not new-disc even though every listing is fresh', () => {
  // Reproduces the Laseri/Talisman bug: the disc vanished from
  // scraped-prices.json entirely for a while (so every current listing's
  // firstSeen looks brand new), but it was already a data/discs.js entry
  // well before this week — oldCatalogIds is how the caller (git history)
  // tells us that.
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'a.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({
    snapshot,
    catalog: CATALOG,
    asOfMs: NOW,
    oldCatalogIds: new Set(['innova-destroyer']),
  });
  assert.equal(signals.length, 1);
  // Not new-disc — that's the actual bug fix. It falls to new-release here
  // specifically because this fixture has no OTHER entry left proving the
  // Star plastic was already known (every listing vanished and came back
  // fresh) — a real restock with a still-known plastic elsewhere would
  // correctly land on new-at-store instead, per the existing baseline
  // logic below this branch.
  assert.notEqual(signals[0].type, 'new-disc');
  assert.equal(signals[0].type, 'new-release');
});

test('buildNewInStoresSignals: restocked disc lands on new-at-store when a surviving old listing proves the plastic isn\'t new', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' }, // survived, old evidence
        { store: 'b', price: 210, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'b.no' }, // just restocked here
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({
    snapshot,
    catalog: CATALOG,
    asOfMs: NOW,
    oldCatalogIds: new Set(['innova-destroyer']),
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-at-store');
});

test('buildNewInStoresSignals: genuinely new catalog id (absent from oldCatalogIds) is still new-disc', () => {
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'a.no' },
      ],
    },
  };
  const { signals } = buildNewInStoresSignals({
    snapshot,
    catalog: CATALOG,
    asOfMs: NOW,
    oldCatalogIds: new Set(), // innova-destroyer was NOT in the catalog before -> genuinely new
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-disc');
});

test('buildNewInStoresSignals: catalogAddedAt overrides oldCatalogIds when present', () => {
  const recentCatalog = [
    ...CATALOG.filter((d) => d.id !== 'innova-destroyer'),
    { id: 'innova-destroyer', name: 'Destroyer', brand: 'Innova', catalogAddedAt: iso(3 * DAY) },
  ];
  const snapshot = {
    stores: STORES,
    prices: {
      ...ANCHOR,
      'innova-destroyer': [
        { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(3 * DAY), url: 'a.no' },
      ],
    },
  };
  // Even though oldCatalogIds says it was already there, an explicit recent
  // catalogAddedAt wins — this is the "add the field going forward" path.
  const { signals } = buildNewInStoresSignals({
    snapshot,
    catalog: recentCatalog,
    asOfMs: NOW,
    oldCatalogIds: new Set(['innova-destroyer']),
  });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-disc');
});

test('buildNewInStoresSignals: known disc, brand-new plastic at any store -> new-release', () => {
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
  assert.equal(signals[0].type, 'new-release');
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
  // Store b's Champion plastic is new-release; store c's Star plastic
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
  assert.deepEqual(types, ['new-at-store', 'new-release']);
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
  // Must be new-release (a new plastic on an established disc), NOT new-disc.
  assert.equal(signals[0].type, 'new-release');
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

// ── Weekly per-store new-at-store cap (2026-08-31) ──────────────────────────

test('buildNewInStoresSignals: >20 new-at-store signals from one store in a week are suppressed', () => {
  const prices = { ...ANCHOR };
  // 21 already-established discs (known plastic at store a) newly arriving
  // at store b, spread across the week rather than one day -> never trips
  // the >30-in-one-day mass-reset check, but should trip the weekly cap.
  for (let i = 0; i < 21; i++) {
    prices[`flood-disc-${i}`] = [
      { store: 'a', price: 150, inStock: true, plastic: 'DX', firstSeen: iso(60 * DAY), url: `a-${i}.no` },
      { store: 'b', price: 145, inStock: true, plastic: 'DX', firstSeen: iso(2 * DAY), url: `b-${i}.no` },
    ];
  }
  const catalog = [
    ...CATALOG,
    ...Array.from({ length: 21 }, (_, i) => ({ id: `flood-disc-${i}`, name: `Flood ${i}`, brand: 'Innova' })),
  ];
  const snapshot = { stores: STORES, prices };
  const { signals, weeklyCapEvents } = buildNewInStoresSignals({ snapshot, catalog, asOfMs: NOW });
  assert.equal(signals.length, 0);
  assert.equal(weeklyCapEvents.length, 1);
  assert.equal(weeklyCapEvents[0].store, 'b');
  assert.equal(weeklyCapEvents[0].count, 21);
});

test('buildNewInStoresSignals: weekly new-at-store cap does not touch new-disc or new-release', () => {
  const prices = { ...ANCHOR };
  for (let i = 0; i < 21; i++) {
    prices[`flood-disc-${i}`] = [
      { store: 'a', price: 150, inStock: true, plastic: 'DX', firstSeen: iso(60 * DAY), url: `a-${i}.no` },
      { store: 'b', price: 145, inStock: true, plastic: 'DX', firstSeen: iso(2 * DAY), url: `b-${i}.no` },
    ];
  }
  // Same store, same week, already over the new-at-store cap — but a
  // brand-new plastic (new-release) and a brand-new disc (new-disc) at
  // store b must still come through uncapped, since the cap is scoped to
  // new-at-store only.
  prices['innova-destroyer'] = [
    { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
    { store: 'b', price: 199, inStock: true, plastic: 'Proto Glow', firstSeen: iso(2 * DAY), url: 'b-glow.no' },
  ];
  prices['brand-new-disc'] = [
    { store: 'b', price: 100, inStock: true, plastic: 'DX', firstSeen: iso(2 * DAY), url: 'b-new.no' },
  ];
  const catalog = [
    ...CATALOG,
    { id: 'brand-new-disc', name: 'Brand New', brand: 'Innova' },
    ...Array.from({ length: 21 }, (_, i) => ({ id: `flood-disc-${i}`, name: `Flood ${i}`, brand: 'Innova' })),
  ];
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog, asOfMs: NOW });
  const types = signals.map((s) => s.type).sort();
  assert.deepEqual(types, ['new-disc', 'new-release']);
});

test('buildNewInStoresSignals: weekly cap at one store does not suppress another store under the cap', () => {
  const prices = { ...ANCHOR };
  for (let i = 0; i < 21; i++) {
    prices[`flood-disc-${i}`] = [
      { store: 'a', price: 150, inStock: true, plastic: 'DX', firstSeen: iso(60 * DAY), url: `a-${i}.no` },
      { store: 'b', price: 145, inStock: true, plastic: 'DX', firstSeen: iso(2 * DAY), url: `b-${i}.no` },
    ];
  }
  prices['innova-destroyer'] = [
    { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
    { store: 'c', price: 195, inStock: true, plastic: 'Star', firstSeen: iso(2 * DAY), url: 'c.no' },
  ];
  const catalog = [
    ...CATALOG,
    ...Array.from({ length: 21 }, (_, i) => ({ id: `flood-disc-${i}`, name: `Flood ${i}`, brand: 'Innova' })),
  ];
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].discId, 'innova-destroyer');
  assert.equal(signals[0].stores[0].store, 'c');
});

// ── Edition-marker-driven new-release (2026-08-18 taxonomy change) ─────────
// Players define "new" by purchasability, not mold: a Tour Series or
// dated-year stamp on a mold we've long sold in a known plastic is still a
// real drop, not just "another Star Destroyer at a new store".

test('buildNewInStoresSignals: known plastic + new edition marker -> new-release, not new-at-store', () => {
  const prices = {
    ...ANCHOR,
    'innova-destroyer': [
      // Star has been around a while, no edition — this is the baseline.
      { store: 'a', price: 200, inStock: true, plastic: 'Star', edition: null, firstSeen: iso(60 * DAY), url: 'a.no' },
      // Same plastic (Star!) but a brand-new Tour Series stamp on it.
      { store: 'b', price: 230, inStock: true, plastic: 'Star', edition: 'Tour Series', firstSeen: iso(2 * DAY), url: 'b.no' },
    ],
  };
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-release');
  assert.equal(signals[0].edition, 'Tour Series');
});

test('buildNewInStoresSignals: differently-worded edition markers for the same drop normalize into ONE signal', () => {
  // "TS ... 2026" and "Tour Series ... 2026" — two stores' own wording for
  // what is, in reality, the same real-world drop.
  const prices = {
    ...ANCHOR,
    'innova-destroyer': [
      { store: 'a', price: 200, inStock: true, plastic: 'Star', edition: null, firstSeen: iso(60 * DAY), url: 'a.no' },
      { store: 'b', price: 230, inStock: true, plastic: 'Star', edition: 'Tour Series 2026', firstSeen: iso(3 * DAY), url: 'b.no' },
      { store: 'c', price: 235, inStock: true, plastic: 'Star', edition: '2026 Tour Series', firstSeen: iso(2 * DAY), url: 'c.no' },
    ],
  };
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1); // NOT two separate new-release entries
  assert.equal(signals[0].type, 'new-release');
  assert.equal(signals[0].stores.length, 2); // store b and c, merged
});

test('buildNewInStoresSignals: an already-seen edition marker on a new plastic is still just new-release once, not double-counted', () => {
  const prices = {
    ...ANCHOR,
    'innova-destroyer': [
      { store: 'a', price: 200, inStock: true, plastic: 'Star', edition: 'Tour Series', firstSeen: iso(60 * DAY), url: 'a.no' },
      // Same Tour Series marker (already established), but a genuinely new plastic -> still new-release, via the plastic path.
      { store: 'b', price: 260, inStock: true, plastic: 'Halo Star', edition: 'Tour Series', firstSeen: iso(2 * DAY), url: 'b.no' },
    ],
  };
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-release');
});

test('buildNewInStoresSignals: unrecognized/cosmetic edition text never triggers new-release on its own', () => {
  const prices = {
    ...ANCHOR,
    'innova-destroyer': [
      { store: 'a', price: 200, inStock: true, plastic: 'Star', edition: null, firstSeen: iso(60 * DAY), url: 'a.no' },
      // "Swirly" isn't a recognized edition-keyword marker (see edition-keywords.js)
      // and the plastic (Star) is already known -> new-at-store, not new-release.
      { store: 'b', price: 210, inStock: true, plastic: 'Star', edition: 'Swirly', firstSeen: iso(2 * DAY), url: 'b.no' },
    ],
  };
  const snapshot = { stores: STORES, prices };
  const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs: NOW });
  assert.equal(signals.length, 1);
  assert.equal(signals[0].type, 'new-at-store');
});

test('buildNewInStoresSignals: mass-reset edition evidence still counts as a baseline for edition markers too', () => {
  // Mirrors the plastic-baseline mass-reset test above, but for editions:
  // a Tour Series listing whose only evidence is a suppressed mass-reset
  // date must still prove "Tour Series has been seen before" for this mold.
  const prices = { ...ANCHOR };
  prices['innova-destroyer'] = [
    { store: 'a', price: 200, inStock: true, plastic: 'Star', edition: 'Tour Series', firstSeen: iso(60 * DAY), url: 'a.no' },
    { store: 'b', price: 230, inStock: true, plastic: 'Halo Star', edition: 'Tour Series', firstSeen: iso(2 * DAY), url: 'b.no' },
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
  // The Halo Star plastic is what's new here — Tour Series was already
  // established (even if only via a mass-reset-suppressed entry).
  assert.equal(signals[0].type, 'new-release');
});

// ── Week freezing (2026-08-31) ───────────────────────────────────────────

test('partitionWeeksForFreezing: live week is always written, past unfrozen week is written once, already-frozen week is skipped', () => {
  const weeks = [
    { isoWeek: '2026-W34', signals: [] },
    { isoWeek: '2026-W33', signals: [] },
    { isoWeek: '2026-W32', signals: [] },
  ];
  const { toWrite, toSkip } = partitionWeeksForFreezing({
    weeks,
    currentIsoWeek: '2026-W34',
    frozenIsoWeeks: new Set(['2026-W32']), // W32 was frozen by an earlier run; W33 never got its first freeze yet
  });
  assert.deepEqual(
    toWrite.map((w) => [w.isoWeek, w.frozen]),
    [['2026-W34', false], ['2026-W33', true]]
  );
  assert.deepEqual(toSkip, ['2026-W32']);
});

test('partitionWeeksForFreezing: forceRefreezeIsoWeeks overrides an already-frozen skip', () => {
  const weeks = [{ isoWeek: '2026-W32', signals: [] }];
  const { toWrite, toSkip } = partitionWeeksForFreezing({
    weeks,
    currentIsoWeek: '2026-W34',
    frozenIsoWeeks: new Set(['2026-W32']),
    forceRefreezeIsoWeeks: new Set(['2026-W32']),
  });
  assert.equal(toSkip.length, 0);
  assert.deepEqual(toWrite.map((w) => [w.isoWeek, w.frozen]), [['2026-W32', true]]);
});

test('freezing makes a frozen week byte-identical on a simulated disk across two runs with different asOfMs', () => {
  // entryFirstSeen is 10 days before NOW -> 2026-W32, already two ISO weeks
  // in the past relative to NOW (2026-W34) and relative to NOW+7d
  // (2026-W35) alike — confirmed via isoWeekKey, not assumed.
  const entryFirstSeenMs = NOW - 10 * DAY;
  assert.equal(isoWeekKey(entryFirstSeenMs), '2026-W32');
  assert.equal(isoWeekKey(NOW), '2026-W34');
  assert.equal(isoWeekKey(NOW + 7 * DAY), '2026-W35');

  const prices = {
    ...ANCHOR,
    'innova-destroyer': [
      { store: 'a', price: 200, inStock: true, plastic: 'Star', firstSeen: iso(60 * DAY), url: 'a.no' },
      {
        store: 'b',
        price: 220,
        inStock: true,
        plastic: 'Halo Star',
        firstSeen: new Date(entryFirstSeenMs).toISOString(),
        url: 'b.no',
      },
    ],
  };
  const snapshot = { stores: STORES, prices };

  // Stand-in for the real filesystem: isoWeek -> the exact string that
  // would have been written to data/new-in-stores/<isoWeek>.json.
  const disk = new Map();
  const frozenIsoWeeks = new Set();

  function runPipeline(asOfMs, currentIsoWeek) {
    const { signals } = buildNewInStoresSignals({ snapshot, catalog: CATALOG, asOfMs });
    const weeks = groupSignalsByWeek(signals);
    const { toWrite } = partitionWeeksForFreezing({ weeks, currentIsoWeek, frozenIsoWeeks });
    for (const week of toWrite) {
      disk.set(week.isoWeek, JSON.stringify({ ...week, generated: `run-at-${asOfMs}` }));
      if (week.frozen) frozenIsoWeeks.add(week.isoWeek);
    }
  }

  // Run 1: W32's Halo Star entry is 10 days old, inside the 14-day
  // SIGNAL_WINDOW_MS -> produces a signal, W32 isn't live (W34 is) and
  // isn't frozen yet -> gets written and frozen for the first time.
  runPipeline(NOW, '2026-W34');
  const w32AfterRun1 = disk.get('2026-W32');
  assert.ok(w32AfterRun1);
  assert.match(w32AfterRun1, /"signals":\[\{/); // sanity: it actually has a signal in it

  // Run 2, one week later: the SAME entry is now 17 days old — past the
  // window — so a naive recompute would silently DROP it (the exact bug
  // freezing exists to prevent). But W32 is already frozen, so the pipeline
  // skips it entirely; whatever run 1 wrote is still what's "on disk".
  runPipeline(NOW + 7 * DAY, '2026-W35');
  const w32AfterRun2 = disk.get('2026-W32');

  assert.equal(w32AfterRun2, w32AfterRun1);
});
