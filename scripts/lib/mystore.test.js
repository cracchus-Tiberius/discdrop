'use strict';

// Tests for the shared Mystore parser. Both card renderings are covered —
// Frisbeebutikken/Starframe serve the addToCart handler form, Krokhol serves
// server-rendered card markup — because parseListing() has to keep handling
// both for the extraction to be worth anything.

const test = require('node:test');
const assert = require('node:assert');
const { parseNok, parseAddToCartCards, parseServerRenderedCards, parseListing } = require('./mystore.js');

test('parseNok reads the Mystore price forms', () => {
  assert.strictEqual(parseNok('189,-'), 189);
  assert.strictEqual(parseNok('1 025,-'), 1025);
  assert.strictEqual(parseNok(null), null);
  assert.strictEqual(parseNok('Utsolgt'), null);
});

test('parseNok treats a trailing ,00 as decimals, not digits', () => {
  // The per-store scrapers this was extracted from used
  // replace(/[^\d]/g,'') here, which returns 21900 for this input. Neither of
  // those stores serves the decimal form, so it never bit — but a shared
  // parser cannot assume the next store's theme is as convenient.
  assert.strictEqual(parseNok('219,00'), 219);
  assert.strictEqual(parseNok('248,75'), 249);
});

const HANDLER = `<button @click.prevent="async () => { await $store.cart.addToCart({
  name: 'Champion Caiman', image: 'https://cdn/img.jpg', price: '219,-',
  url: 'https://frisbeebutikken.no/products/champion-caiman', brand: 'Innova' }) }">`;

test('parseAddToCartCards reads the Alpine handler form', () => {
  const [p] = parseAddToCartCards(HANDLER);
  assert.strictEqual(p.rawName, 'Champion Caiman');
  assert.strictEqual(p.price, 219);
  assert.strictEqual(p.productUrl, 'https://frisbeebutikken.no/products/champion-caiman');
  assert.strictEqual(p.inStock, true);
  assert.strictEqual(p.image, 'https://cdn/img.jpg');
});

test('parseAddToCartCards drops sub-50 kr prices and non-discs', () => {
  assert.deepStrictEqual(parseAddToCartCards(HANDLER.replace("'219,-'", "'35,-'")), []);
  assert.deepStrictEqual(parseAddToCartCards(HANDLER.replace('Champion Caiman', 'Innova Sticker Pack')), []);
});

const CARD = (inner) => `<div class="button_is_buy_now_button product-box cards" ${inner}</div></div>`;

const KROKHOL_SALE = CARD(`data-price-including-tax="209" data-special-price-including-tax="189">
  <div class="product" data-quantity="14" data-manufacturer="Innova">
    <a href="/products/star-destroyer" class="__product_url"><img src="https://cdn/d.jpg"></a>
    <div class="product_box_title_row"><a href="/products/star-destroyer" class="title col-md-12">Star Destroyer</a></div>
    <div class="price has-special-price"><s>209,-</s><span class="special">189,-</span></div>`);

test('parseServerRenderedCards reads Krokhol-style markup', () => {
  const [p] = parseServerRenderedCards(KROKHOL_SALE, { baseUrl: 'https://www.krokholdgs.no' });
  // Brand comes from data-manufacturer — the visible title carries the plastic
  // but not the brand, and matchDisc brand-gates short mold names.
  assert.strictEqual(p.rawName, 'Innova Star Destroyer');
  // Sale price, not the struck-through former price.
  assert.strictEqual(p.price, 189);
  assert.strictEqual(p.productUrl, 'https://www.krokholdgs.no/products/star-destroyer');
  assert.strictEqual(p.inStock, true);
});

test('parseServerRenderedCards marks zero-quantity out of stock', () => {
  const [p] = parseServerRenderedCards(KROKHOL_SALE.replace('data-quantity="14"', 'data-quantity="0"'),
    { baseUrl: 'https://www.krokholdgs.no' });
  assert.strictEqual(p.inStock, false);
});

test('parseListing falls back from the handler form to card markup', () => {
  const store = { baseUrl: 'https://www.krokholdgs.no' };
  assert.strictEqual(parseListing(HANDLER, { baseUrl: 'https://frisbeebutikken.no' }).products[0].rawName, 'Champion Caiman');
  assert.strictEqual(parseListing(KROKHOL_SALE, store).products[0].rawName, 'Innova Star Destroyer');
});

test('parseListing reads the highest page number from both URL shapes', () => {
  // "?page=" alone does not match "?&page=2" — it is a substring test, and
  // that string contains "?&page=". Stores on the ?&page= shape need both.
  const amp = '<a href="/categories/x?&page=4">4</a><a href="/categories/x?&page=2">2</a>';
  const plain = '<a href="/categories/x/sort-by/1/?page=6">6</a>';
  assert.strictEqual(parseListing(amp, {}).maxPage, 4);
  assert.strictEqual(parseListing(plain, {}).maxPage, 6);
  assert.strictEqual(parseListing(amp, { paginationSelector: 'a[href*="?page="]' }).maxPage, 1);
});
