'use strict';

// Tests for the mold matcher's separator-insensitive path (see CLAUDE.md's
// "Matcher-regler"). The traps below are not hypothetical — each one is a
// real false positive produced by the obvious-but-wrong implementation of
// this rule (strip all spaces from the title, then substring-test the
// catalog name against it).

const test = require('node:test');
const assert = require('node:assert');
const { matchDisc } = require('./stores.config.js');

const id = (name) => { const d = matchDisc(name); return d ? d.id : null; };

test('a two-word title matches a one-word catalog name', () => {
  // Discmania writes its own mold "Cloud Breaker"; our catalog says
  // "Cloudbreaker". 55 live listings across the store network hung on this.
  assert.strictEqual(id('Discmania Q-Line Premier Cloud Breaker - Gannon Buhr'), 'discmania-cloudbreaker');
  assert.strictEqual(id('Discmania Cloudbreaker'), 'discmania-cloudbreaker');
  assert.strictEqual(id('Discmania Neo CloudBreaker'), 'discmania-cloudbreaker');
});

test('an all-caps title matches a camelCase catalog name', () => {
  // norm() splits camelCase, so catalog "XCaliber" becomes "x caliber" while
  // an all-caps "XCALIBER" stays one word — the two could never meet before.
  assert.strictEqual(id('STAR XCALIBER'), 'innova-xcaliber');
  assert.strictEqual(id('Champion Xcaliber'), 'innova-xcaliber');
  assert.strictEqual(id('JEREMY KOLING SIGNATURE STAR AVIARX3'), 'innova-aviarx3');
});

test('joining adjacent words does not invent a match', () => {
  // Every one of these is what a space-stripped substring test returns.
  assert.notStrictEqual(id('Axiom Discs Eclipse Glow Aspect - Simon Lizotte'), 'discraft-wasp');   // "glow aspect" ⊅ wasp
  assert.notStrictEqual(id('DGA ProLine Hellfire'), 'latitude-fire');                              // "hellfire" ⊅ fire
  assert.notStrictEqual(id('Climo Disc Golf Victory Line Sparkle Streak'), 'latitude-spark');      // "sparkle" ⊅ spark
  assert.notStrictEqual(id('Discraft Z Line Colorshift Fossil'), 'mvp-shift');                     // "colorshift" ⊅ shift
  assert.notStrictEqual(id('Discraft Premium Midrange - Assorted Hot Stamp'), 'streamline-range'); // "midrange" ⊅ range
});

test('"Nova" does not match inside the word "Innova"', () => {
  // The brand name contains a mold name. A title with no mold at all must
  // not resolve to innova-nova on the strength of the brand alone.
  assert.strictEqual(id('Innova Stainless Steel Water Bottle'), null);
  // ...while a real Nova still matches.
  assert.strictEqual(id('Innova DX Nova'), 'innova-nova');
});

test('the catalog stores Bokeh as a mold, not a plastic-prefixed name', () => {
  // axiom-bokeh-lizotte used to carry name "Neutron Bokeh", which meant only
  // listings in that one plastic could match and the plastic was never
  // extracted as a variant.
  assert.strictEqual(id('Axiom Discs Axiom Bokeh - Premium Factory Misprint'), 'axiom-bokeh-lizotte');
  assert.strictEqual(id('Axiom Neutron Bokeh'), 'axiom-bokeh-lizotte');
  assert.strictEqual(id('Axiom Discs Cosmic Neutron Bokeh - Simon Lizotte'), 'axiom-bokeh-lizotte');
});

// ── Catalog expansion 2026-09-04 ─────────────────────────────────────────────

test('the newly catalogued molds match real store titles', () => {
  assert.strictEqual(id('DGA ProLine Sail'), 'dga-sail');
  assert.strictEqual(id('DGA Tour Series Swirl Aftershock - Cole Redalen 2026'), 'dga-aftershock');
  assert.strictEqual(id('DGA Signature Line Blunt Gumbputt'), 'dga-blunt');
  assert.strictEqual(id('Climo Disc Golf Victory Line Osprey'), 'climo-osprey');
  assert.strictEqual(id('Climo Disc Golf Trophy Line Soft Cliff'), 'climo-cliff');
  assert.strictEqual(id('Discmania Neo Enigma'), 'discmania-enigma');
  assert.strictEqual(id('Discmania Active Premium Tailor'), 'discmania-tailor');
  assert.strictEqual(id('Prodigy Disc 400 Plastic H1v2'), 'prodigy-h1v2');
  assert.strictEqual(id('Innova Halo Star Wombat'), 'innova-wombat');
  assert.strictEqual(id('Clash Discs Softy Mint'), 'clash-mint');
  assert.strictEqual(id('Axiom Discs Eclipse Glow Aspect - Simon Lizotte'), 'axiom-aspect');
  assert.strictEqual(id('Streamline Neutron Boost'), 'streamline-boost');
});

test('DGA Hellfire and Breaker do not swallow other brands\' molds', () => {
  // Both DGA names contain a shorter catalog name as a substring — "fire"
  // (latitude-fire) and "breaker" (inside discmania-cloudbreaker).
  assert.strictEqual(id('DGA ProLine Hellfire'), 'dga-hellfire');
  assert.strictEqual(id('Latitude 64 Opto Fire'), 'latitude-fire');
  assert.strictEqual(id('DGA D-Line Breaker'), 'dga-breaker');
  assert.strictEqual(id('Discmania Q-Line Premier Cloud Breaker'), 'discmania-cloudbreaker');
});

test('Innova Sync and Wombat keep clear of Nova and Wombat3', () => {
  assert.strictEqual(id('Innova Star Sync'), 'innova-sync');
  assert.strictEqual(id('Innova DX Nova'), 'innova-nova');
  assert.strictEqual(id('Innova Halo Star Wombat'), 'innova-wombat');
  assert.strictEqual(id('Innova Star Wombat3'), 'innova-wombat3');
});

test('XCaliber survives the Caliber name it contains', () => {
  // Guards the Discraft Caliber entry that is parked pending manufacturer
  // flight numbers. norm() splits camelCase, so catalog "XCaliber" becomes
  // "x caliber" — a bare "Caliber" entry sits one word away from it. These
  // must keep resolving to Innova when Caliber is eventually added.
  assert.strictEqual(id('STAR XCALIBER'), 'innova-xcaliber');
  assert.strictEqual(id('Champion Xcaliber'), 'innova-xcaliber');
  assert.strictEqual(id('Xcaliber - Nate Sexton'), 'innova-xcaliber');
});

test('Prodigy ACE Line stability suffixes are their own molds', () => {
  // Prodigy's ACE Line runs three stabilities per model — US (understable),
  // S (stable), OS (overstable). The catalog had stored the S and OS ones as
  // "F Model US S" and "F Model US OS", i.e. the US base name with a second
  // suffix bolted on, which no store writes and which reads as
  // "understable stable". They matched nothing.
  assert.strictEqual(id('Prodigy Disc BaseGrip F Model S'), 'discmania-f-model-s');
  assert.strictEqual(id('Prodigy Disc DuraFlex M Model S'), 'discmania-m-model-s');
  assert.strictEqual(id('Prodigy Disc DuraFlex D Model OS'), 'discmania-d-model-os');
  assert.strictEqual(id('DuraFlex GLOW P Model S'), 'discmania-p-model-s');
  // The US variants still resolve to their own entries.
  assert.strictEqual(id('Prodigy Disc ACE Line F Model US'), 'discmania-f-model');
  assert.strictEqual(id('ACE Line D Model US'), 'discmania-d-model');
});
