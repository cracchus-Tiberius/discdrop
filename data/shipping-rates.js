'use strict';

// data/shipping-rates.js — verified shipping and pickup, per store.
//
// Every rate here was confirmed by going through the store's own checkout or
// shipping page, not read off marketing copy, and each row records where the
// number came from and when. That provenance is the point: shipping rates
// change, and a number with no date attached is a number nobody can audit.
//
// `from` is a FLOOR, not an estimate. It is the cheapest tier that a single
// disc (~175 g) actually qualifies for, which is why the UI says "frakt fra
// kr X". Quoting a heavier tier would overstate the landed price and push a
// store down the ranking it should have won; quoting something below the
// cheapest real tier would do the opposite and mislead a buyer at checkout.
// When in doubt the rule is: pick the tier one disc qualifies for, and let the
// wording carry the uncertainty.
//
// Before this file existed, every Norwegian store inherited a hardcoded 45 kr
// from its scraper config and lib/disc-utils.ts's `meta?.shipping ?? 45`
// fallback. Eight of the eleven stores checked on 2026-09-05 were wrong, by up
// to 45 kr — enough to reorder "best price including shipping" outright.
//
// mergeStoreResults() in scripts/stores.config.js applies these over whatever
// a scraper passes as its own meta, so this file wins and the scrapers do not
// each need editing.
//
// Adding a store: fill in every field. `source` should say how it was checked
// ("checkout", a URL, a carrier and weight tier), not just "the website".

const SHIPPING_RATES = {
  nydisk: {
    from: 65,
    source: 'test-checkout, Bring pakke i postkassen 0-249 g',
    verifiedAt: '2026-09-05',
    pickup: { available: true, location: 'Nannestad' },
  },
  krokhol: {
    from: 39,
    source: 'checkout; also krokholdgs.no/pages/shipping "Pakke i postkassen (Posten): 39 kr"',
    verifiedAt: '2026-09-05',
    pickup: { available: true, location: 'Siggerud', note: 'Pro Shop' },
  },
  frisbeebutikken: {
    from: 49,
    freeShippingOver: 1500,
    source: 'checkout, PostNord',
    verifiedAt: '2026-09-05',
    pickup: { available: false },
  },
  aceshop: {
    from: 29,
    source: 'checkout, pakke til postkasse',
    verifiedAt: '2026-09-05',
    pickup: { available: true, location: 'Sandnes' },
  },
  wearediscgolf: {
    from: 45,
    source: 'checkout, HeltHjem inkl. mva',
    verifiedAt: '2026-09-05',
    // location is the short label the badge shows; the street address lives in
              // note, which the badge exposes as a tooltip. A chip has room for a
              // place name, not a postal address.
    pickup: { available: true, location: 'Oslo', note: 'Østre Aker Vei 203, Collect@warehouse' },
  },
  kvamdgs: {
    from: 69,
    source: 'checkout, Bring pakke i postkassen',
    verifiedAt: '2026-09-05',
    pickup: { available: false },
  },
  arcticdisc: {
    from: 69,
    freeShippingOver: 1199,
    source: 'fraktside, pakke i postkassen 0-2 kg',
    verifiedAt: '2026-09-05',
    pickup: { available: false },
  },
  golfdiscer: {
    from: 49,
    // The 49 tier caps at 400 g, which is two discs. For the single disc this
    // floor describes, it is the correct rate.
    source: 'fraktside, pakke i postkassen <=400 g uten sporing',
    verifiedAt: '2026-09-05',
    // "lageret" is not a place a reader can picture, and GolfDiscer publish no
    // town for it, so the badge says only that collection is by arrangement.
    pickup: { available: true, byArrangement: true, note: 'på lageret, etter avtale' },
  },
  frisbeesor: {
    from: 90,
    source: 'checkout, Bring Hjem',
    verifiedAt: '2026-09-05',
    pickup: { available: true, location: 'Sandefjord', byArrangement: true, note: 'raymond@frisbeesor.no' },
  },
  starframe: {
    from: 50,
    source: 'checkout, Bring pakke i postkassen',
    verifiedAt: '2026-09-05',
    pickup: { available: true, location: 'Brumunddal', note: 'Nils Amblis Veg 4, klikk og hent' },
  },
  hyzershop: {
    from: 69,
    source: 'checkout, Posten pakke i postkassen',
    verifiedAt: '2026-09-05',
    pickup: { available: false },
  },
};

// freeShippingOver appears only where that threshold was itself verified on
// 2026-09-05 — frisbeebutikken and arcticdisc. The other stores' thresholds
// come from their scraper configs and have not been checked, so they are
// deliberately absent here and keep applying from there. A number carried into
// this file under a verifiedAt stamp it did not earn would defeat the whole
// point of recording provenance.
//
// Stores still carrying whatever their scraper config claims, unverified:
// discexpress, rocketdiscs, discsport, discshopen, ugglans, discace,
// discgolfdynasty, discsor. Mostly the Swedish/EU ones. They are deliberately
// absent rather than guessed at — an unverified row in this file would defeat
// its purpose.

module.exports = { SHIPPING_RATES };
