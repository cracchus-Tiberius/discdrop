'use strict';

// Tests for scripts/probe-krokhol.js's two pieces of real logic: the
// Norwegian price parser and the 50 kr floor assertion. Both run offline.
// Delete alongside probe-krokhol.js once Krokhol is wired into the pipeline
// (its parser/assertion move to the permanent implementation).

const test = require('node:test');
const assert = require('node:assert');
const { parseNok, priceGate } = require('./probe-krokhol.js');

test('parseNok handles the Mystore "189,-" form', () => {
  assert.strictEqual(parseNok('189,-'), 189);
  assert.strictEqual(parseNok('249,-'), 249);
});

test('parseNok handles thousands with a space separator', () => {
  assert.strictEqual(parseNok('1 025,-'), 1025);
});

test('parseNok treats a trailing ,00 as decimals, not digits', () => {
  // The naive replace(/[^\d]/g,'') this codebase uses elsewhere returns
  // 21900 here — a 100x error that would sail past the 50 kr floor and get
  // caught only by the 600 kr ceiling.
  assert.strictEqual(parseNok('219,00'), 219);
  assert.strictEqual(parseNok('39,00'), 39);
  assert.strictEqual(parseNok('248,75'), 249);
});

test('parseNok returns null for junk', () => {
  assert.strictEqual(parseNok(null), null);
  assert.strictEqual(parseNok('Utsolgt'), null);
});

test('priceGate drops entries below the 50 kr floor and above the 600 kr ceiling', () => {
  const kept = priceGate([
    { rawName: 'Champion Caiman', price: 219 },
    { rawName: 'Mini marker', price: 25 },
    { rawName: 'Basket', price: 4500 },
    { rawName: 'Star Destroyer', price: 249 },
  ]);
  assert.deepStrictEqual(kept.map((p) => p.price), [219, 249]);
});

test('priceGate throws when a large share of prices fall below the floor', () => {
  // 25 products, 15 of them sub-50 — the signature of a parse/currency bug.
  const products = [
    ...Array.from({ length: 15 }, (_, i) => ({ rawName: `broken ${i}`, price: 21 })),
    ...Array.from({ length: 10 }, (_, i) => ({ rawName: `ok ${i}`, price: 229 })),
  ];
  assert.throws(() => priceGate(products), /Price floor assertion FAILED/);
});

test('priceGate does not throw on a small sample below the assertion threshold', () => {
  // Under 20 products there is not enough signal to call it a bug.
  const products = [
    { rawName: 'cheap', price: 20 },
    { rawName: 'ok', price: 229 },
  ];
  assert.doesNotThrow(() => priceGate(products));
});

// ── Krokhol's card markup ────────────────────────────────────────────────────
// Fixture trimmed from a real krokholdgs.no category page (the full pages are
// ~850 KB each). Krokhol's Mystore theme emits no addToCart handler at all, so
// the shared parser has to read the server-rendered card instead.

const { parseMystoreCards, parseMystoreAddToCart } = require('./probe-krokhol.js');
const { matchDisc } = require('./stores.config.js');

const CARD = (inner) => `<div class="button_is_buy_now_button product-box cards pb10" ${inner}</div></div>`;

const REGULAR = CARD(`data-price-including-tax="140" data-product-id="311" data-special-percent="0">
  <div class="product" data-quantity="15" data-manufacturer="Kastaplast">
    <a href="https://www.krokholdgs.no/products/k3-reko" class="__product_url"><div class="image"></div></a>
    <div class="product-meta">
      <div class="product_box_title_row text-center">
        <a href="https://www.krokholdgs.no/products/k3-reko" class="title col-md-12">K3 Reko</a>
      </div>
      <div class="price col-12 text-center">140,-</div>`);

const ON_SALE = CARD(`data-price-including-tax="209" data-product-id="1680" data-special-percent="10"
  data-special-price-including-tax="189">
  <div class="product" data-quantity="14" data-manufacturer="Innova">
    <a href="https://www.krokholdgs.no/products/star-destroyer" class="__product_url"><div class="image"></div></a>
    <div class="product-meta">
      <div class="product_box_title_row text-center">
        <a href="https://www.krokholdgs.no/products/star-destroyer" class="title col-md-12">Star Destroyer</a>
      </div>
      <div class="price col-12 has-special-price text-center">
        <s>209,-</s>
        <span class="special pl10">189,-</span>
      </div>`);

const SOLD_OUT = CARD(`data-price-including-tax="199" data-product-id="900" data-special-percent="0">
  <div class="product" data-quantity="0" data-manufacturer="Latitude 64">
    <a href="https://www.krokholdgs.no/products/opto-sapphire" class="__product_url"><div class="image"></div></a>
    <div class="product-meta">
      <div class="product_box_title_row text-center">
        <a href="https://www.krokholdgs.no/products/opto-sapphire" class="title col-md-12">Opto Sapphire</a>
      </div>
      <div class="price col-12 text-center">199,-</div>`);

test('parseMystoreCards reads a plain Krokhol card', () => {
  const [p] = parseMystoreCards(REGULAR);
  assert.strictEqual(p.price, 140);
  assert.strictEqual(p.url, 'https://www.krokholdgs.no/products/k3-reko');
  assert.strictEqual(p.inStock, true);
});

test('parseMystoreCards prefixes the brand from data-manufacturer', () => {
  // The visible title is "Star Destroyer" — plastic, no brand. matchDisc
  // brand-gates short and ambiguous mold names, so the brand has to come from
  // the attribute or those products silently fail to match.
  const [p] = parseMystoreCards(ON_SALE);
  assert.strictEqual(p.rawName, 'Innova Star Destroyer');
});

test('parseMystoreCards does not double up a brand the title already carries', () => {
  const [p] = parseMystoreCards(REGULAR);
  assert.strictEqual(p.rawName, 'Kastaplast K3 Reko');
});

test('parseMystoreCards takes the sale price, not the struck-through one', () => {
  const [p] = parseMystoreCards(ON_SALE);
  assert.strictEqual(p.price, 189);
});

test('parseMystoreCards marks a zero-quantity product out of stock', () => {
  const [p] = parseMystoreCards(SOLD_OUT);
  assert.strictEqual(p.inStock, false);
});

test('parseMystoreCards drops what the keep() pre-filter names', () => {
  // keep() runs isUsedDisc/isMiniDisc/isNonDiscProduct. That last one is a
  // narrow list (sticker, keychain, pin, clip, ...), not a general accessory
  // filter.
  const sticker = REGULAR.replace('>K3 Reko<', '>Krokhol Sticker Pack<');
  assert.deepStrictEqual(parseMystoreCards(sticker), []);
});

test('an accessory the pre-filter misses survives parsing and fails to match', () => {
  // Krokhol lists towels, water bottles and marker pens alongside discs, and
  // neither isNonDiscProduct nor NON_DISC_KEYWORDS names them. That is fine:
  // the parser keeps the card, matchDisc returns null, and it lands in the
  // unmatched bucket — it never reaches a price. Asserted so a future change
  // to keep() does not quietly turn the unmatched count into a filtered one
  // without anyone noticing the match rate move.
  const towel = REGULAR.replace('>K3 Reko<', '>Mikrofiberhåndkle 50x40cm<');
  const [p] = parseMystoreCards(towel);
  assert.strictEqual(p.rawName, 'Kastaplast Mikrofiberhåndkle 50x40cm');
  assert.strictEqual(matchDisc(p.rawName), null);
});

test('parseMystoreAddToCart still reads the Frisbeebutikken/Starframe form', () => {
  // The other two Mystore stores render this instead of card markup — the
  // shared parser has to keep handling both.
  const html = `<div @click="addToCart({ id: 1, name: 'Kastaplast K1 Falk', price: '209,-', url: '/products/k1-falk' })">`;
  const [p] = parseMystoreAddToCart(html);
  assert.strictEqual(p.rawName, 'Kastaplast K1 Falk');
  assert.strictEqual(p.price, 209);
  assert.strictEqual(p.url, 'https://krokholdgs.no/products/k1-falk');
});
