'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isMiniDisc, isNonDiscProduct, isUsedDisc } = require('./plastic-types.js');

test('isMiniDisc catches known mini/marker naming patterns', () => {
  assert.equal(isMiniDisc('K1 Reko Mini'), true);
  assert.equal(isMiniDisc('Reko Mini disc'), true);
  assert.equal(isMiniDisc('Proton Mini-Marker'), true);
  assert.equal(isMiniDisc('Proton Mini Marker'), true);
  assert.equal(isMiniDisc('Eclipse 2.0 Macro'), true);
  // "Puppy" is Latitude 64's naming for a lighter, smaller-diameter version
  // of a mold — confirmed in production: Discsport's "Opto Bite Puppy"
  // (flight numbers 0/0/0/0) matched catalog id latitude-bite, showing up
  // as a fake price drop against the real disc.
  assert.equal(isMiniDisc('Opto Bite Puppy'), true);
});

test('isMiniDisc does not false-positive on real discs', () => {
  assert.equal(isMiniDisc('Latitude 64 Bite'), false);
  assert.equal(isMiniDisc('Opto Bite'), false);
  assert.equal(isMiniDisc('Innova Destroyer'), false);
  // "Macro" and "Mini" must be whole words, not substrings of a real name.
  assert.equal(isMiniDisc('Macropod'), false);
  assert.equal(isMiniDisc('Minimalist'), false);
});

// ── Apparel ─────────────────────────────────────────────────────────────────
// A corpus audit on 2026-11-12 found six garments matched to three discs:
// "Cap Astronaut" -> discmania-astronaut (it owned the only product photo on
// that disc, so a baseball cap was the picture on its /nytt card),
// "Kastaplast Beanie Berg" -> kastaplast-berg at three stores, and two
// t-shirts -> latitude-core.

test('headwear and garments are not discs', () => {
  for (const name of [
    'Cap Astronaut',
    'Kastaplast Beanie Berg',
    'Core Unify Training Tee Menn',
    'Innova Unity Core Womens Tee',
    'DiscDrop Trucker Hat',
    'Lue med logo',
    'Discmania Genser Sort',
    'Team Polo Anthracite',
  ]) {
    assert.strictEqual(isNonDiscProduct(name), true, `${name} should be rejected`);
  }
});

test('"tee" rejects the garment without taking Teebird or TeeDevil with it', () => {
  // Three real molds start with that syllable, and a store writing the name
  // with a space must not lose a genuine disc.
  assert.strictEqual(isNonDiscProduct('Innova Unity Core Womens Tee'), true);
  for (const name of ['Innova Teebird', 'Innova Tee Bird', 'Innova Teebird3', 'Innova TeeDevil', 'Innova Tee Devil']) {
    assert.strictEqual(isNonDiscProduct(name), false, `${name} should be kept`);
  }
});

test('apparel keywords do not swallow molds that merely contain them', () => {
  // cap/hat sit inside Captain, Captain's Raptor and Hatchet; word boundaries
  // are what keep those three discs.
  for (const name of [
    "Discraft Captain's Raptor",
    'Dynamic Captain',
    'Westside Hatchet',
    'Kastaplast K3 Berg',
    'Latitude 64 Opto Core',
    'Discmania Active Premium Astronaut',
  ]) {
    assert.strictEqual(isNonDiscProduct(name), false, `${name} should be kept`);
  }
});

// ── Digit-initial bundle phrases ────────────────────────────────────────────
// NON_DISC_PHRASES is matched with includes(), so '3 disc' fired inside
// "MD3 Discmania": those characters sit across the join of two good words.
// Found 2026-11-12. The two MD3 listings in the price data survived only
// because their real title puts a dash between the mold and the brand.

test('a mold ending in a digit is not a three-disc set', () => {
  for (const name of [
    'C-Line Glow MD3 Discmania Challenge Light Strike',
    'c line glow md3 discmania challenge fundraiser light strike',
    'Discmania MD3 för 299',
    'Innova PD3 Discmania crossover',
    'Discraft Roc3 discontinued run',
  ]) {
    assert.strictEqual(isNonDiscProduct(name), false, `${name} should be kept`);
  }
});

test('real bundles are still rejected, plural included', () => {
  // No trailing boundary on purpose: "3 discs set" is a normal way to write
  // a bundle, and anchoring the end would lose the plural.
  for (const name of [
    'Discmania 3 disc set',
    'MVP 3 discs starter bundle',
    'Kastaplast 3-disc pack',
    'Discsport 3-pack',
    'Ugglans 3 för 299',
    'Starter 3 disc box',
  ]) {
    assert.strictEqual(isNonDiscProduct(name), true, `${name} should be rejected`);
  }
});

test('"shield" no longer deletes the Westside Shield putter', () => {
  // A bare includes('shield') sat next to 'face shield' and threw away every
  // listing of a real disc. westside-shield was in the catalogue with zero
  // prices and nothing recorded why — rejected products never reach
  // unmatched-products.json, so it just looked unstocked.
  for (const name of ['Westside VIP Shield', 'Westside Discs Shield', 'Westside Tournament Shield']) {
    assert.strictEqual(isNonDiscProduct(name), false, `${name} should be kept`);
  }
  assert.strictEqual(isNonDiscProduct('Face Shield'), true);
});

test('phone cases are not discs', () => {
  // "Phone Case Inner Core" matched latitude-core at two stores and fed a
  // frozen /nytt signal in 2026-W34 — merch, like the apparel, but not a
  // garment, so the apparel audit walked straight past it.
  for (const name of ['Phone Case Inner Core', 'Discmania mobildeksel', 'Kastaplast mobilskal']) {
    assert.strictEqual(isNonDiscProduct(name), true, `${name} should be rejected`);
  }
  // "Casey" is a player name on real signature discs, and must survive.
  assert.strictEqual(isNonDiscProduct('Sky Walker 3 Casey White Horizon S-Line FD2'), false);
});

test('Recycled ESP is a Discraft plastic, not a used disc', () => {
  // PLASTIC_TYPES listed it while USED_KEYWORDS' 'recycled' threw it away:
  // on 2026-11-13 no store in scraped-prices.json had a single "recycl" URL.
  for (const name of ['Discraft ESP Recycled Zone', 'Discraft Recycled ESP Challenger', 'Recycled ESP Buzzz']) {
    assert.strictEqual(isUsedDisc(name), false, `${name} should count as new`);
  }
  // The keyword still does its job for discs that really are second-hand.
  for (const name of ['Recycled Zone - brukt', 'Recycled disc, assorted']) {
    assert.strictEqual(isUsedDisc(name), true, `${name} should count as used`);
  }
});
