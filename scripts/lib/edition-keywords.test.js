'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizeEdition, isNotableEdition } = require('./edition-keywords');

test('normalizeEdition dedupes wording differences between stores', () => {
  // Two stores' wording for the same real drop must normalize identically.
  assert.equal(normalizeEdition('Tour Series 2026'), normalizeEdition('2026 Tour Series'));
  assert.equal(normalizeEdition('Team Series'), normalizeEdition('team series'));
});

test('normalizeEdition recognizes player names case-insensitively', () => {
  const a = normalizeEdition('Anthony Barela 2026 Tour Series');
  const b = normalizeEdition('anthony barela tour series 2026');
  assert.equal(a, b);
  assert.ok(a.includes('anthony-barela'));
  assert.ok(a.includes('tour-series'));
});

test('normalizeEdition recognizes a bare year as a marker on its own', () => {
  assert.equal(normalizeEdition('2026'), '2026');
  assert.equal(normalizeEdition('2025'), '2025');
  assert.notEqual(normalizeEdition('2025'), normalizeEdition('2026'));
});

test('normalizeEdition returns null for unrecognized/cosmetic edition strings', () => {
  // These are real values seen in scraped-prices.json — stamp/finish
  // descriptors, not genuine drop-worthy editions.
  for (const e of ['Bar Stamp', 'Bottom Stamp', 'Color Glow', 'Swirly', 'Confetti', 'Supercolor', 'Retooled', 'Goliath']) {
    assert.equal(normalizeEdition(e), null, `expected null for "${e}"`);
  }
  assert.equal(normalizeEdition(null), null);
  assert.equal(normalizeEdition(''), null);
});

test('normalizeEdition combines multiple recognized markers into one comparable key', () => {
  const key = normalizeEdition('Henna Blomroos Halo Champion Proto Glow 2026 Tour Series');
  assert.ok(key.includes('henna-blomroos'));
  assert.ok(key.includes('tour-series'));
  assert.ok(key.includes('2026'));
});

test('isNotableEdition matches the same keyword set normalizeEdition uses', () => {
  assert.equal(isNotableEdition('Tour Series'), true);
  assert.equal(isNotableEdition('Calvin Heimburg'), true);
  assert.equal(isNotableEdition('Ledgestone'), true);
  assert.equal(isNotableEdition('Bar Stamp'), false);
  assert.equal(isNotableEdition(null), false);
});
