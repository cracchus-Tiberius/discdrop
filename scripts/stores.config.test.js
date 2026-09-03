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
