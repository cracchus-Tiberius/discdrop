'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { isMiniDisc, isUsedDisc } = require('./plastic-types.js');

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
