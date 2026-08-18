'use strict';

// scripts/lib/new-in-stores.js — pure computation for the "Nytt i butikk"
// feature. No filesystem/git access here on purpose (that lives in
// scripts/build-new-in-stores.js) so this module is trivially unit-testable,
// same separation as scripts/lib/price-changes.js.
//
// Key insight this whole module leans on: scripts/stores.config.js's
// mergeStoreResults() already tracks firstSeen at (discId|store|plastic)
// granularity and NEVER touches it once set (see that file's comment above
// mergeStoreResults). That means classification only needs ONE current
// snapshot of scraped-prices.json — no git history walking required, unlike
// price-changes.js's day-over-day diffing. A signal is just "this
// (discId, store, plastic) key's firstSeen is recent", cross-referenced
// against every OTHER entry for the same discId to figure out what,
// specifically, is new about it.

const { MIN_VALID_PRICE_NOK, MAX_VALID_PRICE_NOK, entryLandedNOK } = require('./price-changes');

// Same "is this recent" window app/disc-drop-home.tsx and lib/disc-utils.ts
// already use for their own new-drop badges — kept in sync so "new" means
// the same thing everywhere on the site.
const SIGNAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// A store with no listing older than this is still "onboarding" — its
// entire catalog gets a fresh firstSeen the day we start scraping it, which
// would otherwise look like a flood of "new discs" that aren't news to
// anyone, they're just new to US. There's no stored "store onboarding date"
// field anywhere (confirmed: neither scraped-prices.json's stores metadata
// nor stores.config.js record one) — this derives it from the store's own
// earliest firstSeen across all its listings, the same proxy
// scripts/build-price-changes.js's git-snapshot approach exists to avoid
// needing for price history. Quarantined stores' entries are excluded
// entirely from BOTH signal generation and the "have we seen this before"
// baseline other stores' entries are checked against — otherwise an
// invisible quarantined listing could make a later, real store's arrival
// look like a "new-edition" when it isn't.
const STORE_QUARANTINE_MS = 21 * 24 * 60 * 60 * 1000;

// Confirmed in production 2026-08-17: this site's scraper/matching logic
// (scripts/stores.config.js, plastic-types.js, scraper.js) has been under
// near-daily active tuning, and firstSeen is only carried forward per exact
// (discId|store|plastic) key — so a matching-logic fix that changes which
// products successfully match resets firstSeen for every listing whose
// match status flipped. One such fix (2026-08-16, mergeStoreResults +
// brand-check) reset firstSeen for 539 of WeAreDiscGolf's 1094 listings —
// literally half the store — in a single day. 30+ genuinely new products
// arriving at ONE store on ONE day essentially never happens in the
// Norwegian/Nordic disc golf retail market; when it happens in our data,
// it's a scraper artifact, not news. Suppress the whole store+date
// combination rather than trying to guess which of its listings (if any)
// were real — we have no way to tell them apart once firstSeen is reset.
const MASS_RESET_THRESHOLD = 30;

const SIGNAL_TYPE_RANK = { 'new-disc': 0, 'new-edition': 1, 'new-at-store': 2 };

function ageMs(isoDate, asOfMs) {
  return asOfMs - new Date(isoDate).getTime();
}

/** Store keys whose entire listing set is younger than STORE_QUARANTINE_MS. */
function findQuarantinedStores(prices, asOfMs) {
  const oldestFirstSeenByStore = new Map();
  for (const entries of Object.values(prices)) {
    for (const entry of entries) {
      if (!entry.firstSeen) continue;
      const seenMs = new Date(entry.firstSeen).getTime();
      const oldest = oldestFirstSeenByStore.get(entry.store);
      if (oldest == null || seenMs < oldest) oldestFirstSeenByStore.set(entry.store, seenMs);
    }
  }
  const quarantined = new Set();
  for (const [store, oldestMs] of oldestFirstSeenByStore) {
    if (asOfMs - oldestMs < STORE_QUARANTINE_MS) quarantined.add(store);
  }
  return quarantined;
}

/**
 * Store+calendar-date (UTC) combinations where more than
 * MASS_RESET_THRESHOLD listings share the exact same firstSeen day — a
 * matching-logic churn event, not real news. Returns both a lookup Set
 * (`"store|YYYY-MM-DD"` keys, for filtering) and a plain array of
 * `{store, date, count}` for logging what got suppressed and why.
 */
function findMassResetEvents(prices, threshold = MASS_RESET_THRESHOLD) {
  const countByStoreDate = new Map();
  for (const entries of Object.values(prices)) {
    for (const entry of entries) {
      if (!entry.firstSeen) continue;
      const date = entry.firstSeen.slice(0, 10);
      const key = `${entry.store}|${date}`;
      countByStoreDate.set(key, (countByStoreDate.get(key) || 0) + 1);
    }
  }
  const keys = new Set();
  const events = [];
  for (const [key, count] of countByStoreDate) {
    if (count > threshold) {
      keys.add(key);
      const [store, date] = key.split('|');
      events.push({ store, date, count });
    }
  }
  events.sort((a, b) => b.count - a.count);
  return { keys, events };
}

/**
 * Classify every recent (discId, store, plastic) listing into new-disc /
 * new-edition / new-at-store, merge same-disc-same-type listings into one
 * signal per week, and group the result by ISO week (Monday start).
 *
 * @param {{prices: object, stores: object}} snapshot - scraped-prices.json shape
 * @param {{id: string, name: string, brand: string, image?: string}[]} catalog
 * @param {number} asOfMs - "now", in ms (pass scraped-prices.json's lastUpdated
 *   for reproducible output instead of the wall clock at build time)
 */
function buildNewInStoresSignals({ snapshot, catalog, asOfMs }) {
  const prices = (snapshot && snapshot.prices) || {};
  const storesMeta = (snapshot && snapshot.stores) || {};
  const catalogById = new Map(catalog.map((d) => [d.id, d]));
  const quarantinedStores = findQuarantinedStores(prices, asOfMs);
  const { keys: massResetKeys, events: massResetEvents } = findMassResetEvents(prices);

  const rawSignals = [];

  for (const [discId, allEntries] of Object.entries(prices)) {
    const disc = catalogById.get(discId);
    if (!disc) continue; // catalog entry removed/renamed since this snapshot — not our concern here

    // The existing MIN/MAX price floor (garbage-price defense, e.g. the
    // Discexpress/Discsport incidents) plus dropping quarantined stores'
    // listings entirely (see STORE_QUARANTINE_MS — that store's whole
    // presence in our data is unproven, so it's excluded from baselines
    // too). Mass-reset entries (see MASS_RESET_THRESHOLD) stay IN this set,
    // unlike quarantine: a churn event happens at an already-established
    // store we already trust, so the listings are real, just wrongly dated.
    // Treating them as "never existed" would erase the only evidence that,
    // say, Innova Destroyer isn't a brand-new disc. Confirmed in production
    // 2026-08-17: every store carrying Destroyer had its firstSeen reset by
    // the initial firstSeen-tracking rollout (correctly caught as a
    // mass-reset event, since the whole catalog got a fresh date that day)
    // except one isolated, genuinely-recent discexpress listing; excluding
    // mass-reset entries outright left that single listing as the ONLY
    // evidence for the whole disc, misclassifying a disc sold for years as
    // "new-disc". They're kept as baseline evidence but never themselves
    // eligible to trigger a signal — see effectiveAge() below. Used-disc
    // listings never reach scraped-prices.json in the first place (scrapers
    // filter them via isUsedDisc/SKIP_CATEGORY_SLUGS in
    // scripts/stores.config.js before writing), so there's nothing left to
    // filter for that here.
    const entries = allEntries.filter(
      (e) =>
        e.firstSeen &&
        e.inStock &&
        e.price >= MIN_VALID_PRICE_NOK &&
        e.price <= MAX_VALID_PRICE_NOK &&
        !quarantinedStores.has(e.store)
    );
    if (entries.length === 0) continue;

    const isMassReset = (e) => massResetKeys.has(`${e.store}|${e.firstSeen.slice(0, 10)}`);
    // A mass-reset listing's own firstSeen can't be trusted as "just
    // arrived" — treat it as indefinitely old for every baseline check
    // below (it can still prove a disc/plastic ISN'T new; it just can't
    // itself BE the new thing).
    const effectiveAge = (e) => (isMassReset(e) ? Infinity : ageMs(e.firstSeen, asOfMs));

    const isDiscEntirelyNew = entries.every((e) => effectiveAge(e) < SIGNAL_WINDOW_MS);

    for (const entry of entries) {
      if (isMassReset(entry)) continue; // churn, not news — never itself a signal
      const age = effectiveAge(entry);
      if (age >= SIGNAL_WINDOW_MS) continue; // not recent enough to be news

      let type;
      if (isDiscEntirelyNew) {
        type = 'new-disc';
      } else {
        // Has any OTHER entry for this exact plastic already been around
        // longer than the window (or is unreliably dated but still proof
        // the plastic existed)? If not, this plastic/edition has never
        // been seen for this disc before, at any store.
        const plasticSeenBefore = entries.some(
          (o) => o !== entry && o.plastic === entry.plastic && effectiveAge(o) >= SIGNAL_WINDOW_MS
        );
        type = plasticSeenBefore ? 'new-at-store' : 'new-edition';
      }

      const meta = storesMeta[entry.store];
      rawSignals.push({
        discId,
        name: disc.name,
        brand: disc.brand,
        image: disc.image || '',
        type,
        plastic: entry.plastic || null,
        firstSeenMs: new Date(entry.firstSeen).getTime(),
        store: entry.store,
        storeName: (meta && meta.name) || entry.store,
        price: entryLandedNOK(entry, meta),
        url: entry.url,
      });
    }
  }

  // Merge same disc + same signal type into one entry with a stores list —
  // e.g. a disc appearing at 3 stores in one week is ONE "new-disc" entry,
  // not 3. A disc that's simultaneously new-edition (one plastic) and
  // new-at-store (a different, already-known plastic) stays two entries —
  // that's genuinely two different pieces of news.
  const grouped = new Map();
  for (const s of rawSignals) {
    const key = `${s.discId}|${s.type}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        discId: s.discId,
        name: s.name,
        brand: s.brand,
        image: s.image,
        type: s.type,
        plastic: s.plastic,
        firstSeenMs: s.firstSeenMs,
        price: s.price,
        stores: [],
      });
    }
    const g = grouped.get(key);
    g.firstSeenMs = Math.min(g.firstSeenMs, s.firstSeenMs);
    g.price = Math.min(g.price, s.price);
    // A store can list a disc under more than one plastic/edition, and both
    // could land in the same signal type (e.g. two brand-new plastics of the
    // same disc at once) — dedupe to one row per store, keeping its cheapest
    // offer, rather than showing the same store twice in one signal's list.
    const existingStoreEntry = g.stores.find((st) => st.store === s.store);
    if (!existingStoreEntry) {
      g.stores.push({ store: s.store, storeName: s.storeName, price: s.price, url: s.url });
    } else if (s.price < existingStoreEntry.price) {
      existingStoreEntry.price = s.price;
      existingStoreEntry.url = s.url;
    }
  }

  const signals = [...grouped.values()].sort((a, b) => {
    const rankDiff = SIGNAL_TYPE_RANK[a.type] - SIGNAL_TYPE_RANK[b.type];
    return rankDiff !== 0 ? rankDiff : b.firstSeenMs - a.firstSeenMs;
  });

  return { signals, quarantinedStores: [...quarantinedStores], massResetEvents };
}

/** ISO-8601 week number + week-numbering year (Monday start) for a UTC date. */
function getIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 .. Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of this ISO week decides the ISO year
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNumber = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { isoYear, weekNumber };
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
function getIsoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 1);
  return d;
}

function isoDateStr(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Groups already-classified signals by ISO week (Monday start), newest week
 * first. Each signal is assigned to the week containing its (merged, i.e.
 * earliest-across-stores) firstSeen date.
 */
function groupSignalsByWeek(signals) {
  const weeks = new Map();
  for (const s of signals) {
    const date = new Date(s.firstSeenMs);
    const { isoYear, weekNumber } = getIsoWeek(date);
    const key = `${isoYear}-W${String(weekNumber).padStart(2, '0')}`;
    if (!weeks.has(key)) {
      const weekStart = getIsoWeekStart(date);
      const weekEnd = new Date(weekStart);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      weeks.set(key, {
        isoWeek: key,
        year: isoYear,
        weekNumber,
        startDate: isoDateStr(weekStart),
        endDate: isoDateStr(weekEnd),
        signals: [],
      });
    }
    weeks.get(key).signals.push(s);
  }
  return [...weeks.values()].sort((a, b) => b.isoWeek.localeCompare(a.isoWeek));
}

module.exports = {
  SIGNAL_WINDOW_MS,
  STORE_QUARANTINE_MS,
  MASS_RESET_THRESHOLD,
  findQuarantinedStores,
  findMassResetEvents,
  buildNewInStoresSignals,
  getIsoWeek,
  getIsoWeekStart,
  groupSignalsByWeek,
};
