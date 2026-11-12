'use strict';

// Tests for the shared Mystore parser. Both card renderings are covered —
// Frisbeebutikken/Starframe serve the addToCart handler form, Krokhol serves
// server-rendered card markup — because parseListing() has to keep handling
// both for the extraction to be worth anything.

const test = require('node:test');
const assert = require('node:assert');
const { parseNok, parseAddToCartCards, parseServerRenderedCards, parseJsonLdItemList, parseListing } = require('./mystore.js');

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


// ── Rendering 3: JSON-LD ────────────────────────────────────────────────────
// Krokhol's theme changed around 2026-10-30. The card markup rendering 2 reads
// disappeared, the store scraped 0 products for thirteen days, and its 1029
// prices sat on the site as if current. The two items below are copied
// verbatim from the saved https://www.krokholdgs.no/categories/putter-disk of
// 2026-11-12; the rest are variations on them, marked where they are.

const KROKHOL_ITEMS = [
  {
    "@type": "ListItem",
    "position": 1,
    "url": "https://www.krokholdgs.no/products/-d-line-flex3-p2",
    "item": {
      "@type": "Product",
      "@id": "https://www.krokholdgs.no/products/-d-line-flex3-p2#product",
      "name": "D-Line Flex3 P2",
      "url": "https://www.krokholdgs.no/products/-d-line-flex3-p2",
      "image": "https://www.krokholdgs.no/users/krokholdgs_mystore_no/images/Vn1Vj_Discmania__D-Line_Flex3_P2_1.jpg",
      "brand": {
        "@type": "Brand",
        "name": "Discmania"
      },
      "offers": {
        "@type": "Offer",
        "url": "https://www.krokholdgs.no/products/-d-line-flex3-p2",
        "priceCurrency": "NOK",
        "price": 140,
        "availability": "https://schema.org/InStock"
      }
    }
  },
  {
    "@type": "ListItem",
    "position": 41,
    "url": "https://www.krokholdgs.no/products/esp-recycled-zone",
    "item": {
      "@type": "Product",
      "@id": "https://www.krokholdgs.no/products/esp-recycled-zone#product",
      "name": "ESP Recycled Zone",
      "url": "https://www.krokholdgs.no/products/esp-recycled-zone",
      "image": "https://www.krokholdgs.no/users/krokholdgs_mystore_no/images/6xlGV_Discraft_ESP_Recycled_Zone_1.jpg",
      "brand": {
        "@type": "Brand",
        "name": "Discraft"
      },
      "offers": {
        "@type": "Offer",
        "url": "https://www.krokholdgs.no/products/esp-recycled-zone",
        "priceCurrency": "NOK",
        "price": 160,
        "availability": "https://schema.org/InStock"
      }
    }
  }
];

function krokholPage(items, cardsHtml = '') {
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Putter' },
    { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items },
  ] };
  return '<html><head><script type="application/ld+json">' + JSON.stringify(graph) +
    '</script></head><body>' + cardsHtml +
    '<a href="/categories/putter-disk?&page=2">2</a></body></html>';
}

const KROKHOL = { baseUrl: 'https://www.krokholdgs.no' };

test("parseJsonLdItemList reads Krokhol's structured data", () => {
  const [flex, recycled] = parseJsonLdItemList(krokholPage(KROKHOL_ITEMS), KROKHOL);
  assert.deepStrictEqual(flex, {
    rawName: 'Discmania D-Line Flex3 P2',
    price: 140,
    productUrl: 'https://www.krokholdgs.no/products/-d-line-flex3-p2',
    inStock: true,
    image: KROKHOL_ITEMS[0].item.image,
  });
  // Recycled ESP is a Discraft plastic line, new discs — it used to be thrown
  // away as used by the 'recycled' keyword.
  assert.strictEqual(recycled.rawName, 'Discraft ESP Recycled Zone');
  assert.strictEqual(recycled.price, 160);
});

test('parseJsonLdItemList reads real availability instead of assuming in stock', () => {
  // Variation: same item, marked sold out.
  const soldOut = structuredClone(KROKHOL_ITEMS[0]);
  soldOut.item.offers.availability = 'https://schema.org/OutOfStock';
  const [p] = parseJsonLdItemList(krokholPage([soldOut]), KROKHOL);
  assert.strictEqual(p.inStock, false);
});

test('parseJsonLdItemList refuses a price in any currency but NOK', () => {
  // Variation: same item in EUR. A NOK store publishing another currency is a
  // bug to skip, not a number to trust (cf. Discexpress, USD-as-SEK).
  const eur = structuredClone(KROKHOL_ITEMS[0]);
  eur.item.offers.priceCurrency = 'EUR';
  assert.deepStrictEqual(parseJsonLdItemList(krokholPage([eur]), KROKHOL), []);
});

test('a lower price on the card beats the JSON-LD price', () => {
  // The saved page had no sale item, so which price a discounted product
  // publishes is unverified. If its card shows less, the card wins.
  const card = '<article class="product-thumb-info"><a href="/products/-d-line-flex3-p2">x</a>' +
    '<section class="price flex"><p>119,-</p><p class="line-through">140,-</p></section></article>';
  const [p] = parseJsonLdItemList(krokholPage([KROKHOL_ITEMS[0]], card), KROKHOL);
  assert.strictEqual(p.price, 119);
});

test('a card that agrees with JSON-LD changes nothing', () => {
  const card = '<article class="product-thumb-info"><a href="/products/-d-line-flex3-p2">x</a>' +
    '<section class="price flex"><p>140,-</p></section></article>';
  const [p] = parseJsonLdItemList(krokholPage([KROKHOL_ITEMS[0]], card), KROKHOL);
  assert.strictEqual(p.price, 140);
});

test('an unparseable JSON-LD block does not hide a good one', () => {
  const html = krokholPage(KROKHOL_ITEMS).replace('<head>', '<head><script type="application/ld+json">{ not json</script>');
  assert.strictEqual(parseJsonLdItemList(html, KROKHOL).length, 2);
});

test('parseListing reaches JSON-LD only when the card renderings find nothing', () => {
  const { products, maxPage } = parseListing(krokholPage(KROKHOL_ITEMS), KROKHOL);
  assert.strictEqual(products.length, 2);
  assert.strictEqual(maxPage, 2);
});

test('a page with both the handler form and JSON-LD keeps using the handler form', () => {
  // What keeps Frisbeebutikken and Starframe exactly as they were: if Mystore
  // ever adds JSON-LD to their theme too, rendering 1 still wins.
  const handler = `<button @click="addToCart({ name: 'Champion Caiman', price: '219,-', url: 'https://x.no/products/champion-caiman', image: '' })">`;
  const html = krokholPage(KROKHOL_ITEMS).replace('<body>', '<body>' + handler);
  const { products } = parseListing(html, KROKHOL);
  assert.deepStrictEqual(products.map((p) => p.rawName), ['Champion Caiman']);
});
