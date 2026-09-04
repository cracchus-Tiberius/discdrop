'use strict';

// scripts/scrape-krokhol.js — Krokhol Disc Golf Shop (krokholdgs.no).
//
// Mystore platform, same shared implementation as Frisbeebutikken and
// Starframe — see scripts/lib/mystore.js. Two things differ from those two:
//
//  1. Krokhol's theme renders product cards server-side and emits no
//     addToCart() Alpine handler anywhere on the page. The shared parser falls
//     back to the card markup automatically. Notably the visible card title
//     carries the plastic but NOT the brand ("Star Destroyer"), which comes
//     from data-manufacturer instead.
//
//  2. There is no "all discs" parent category, so the four type categories are
//     scraped and de-duplicated by product URL. "lette-disker" cross-cuts them
//     and is included because it carries roughly 10 discs the type categories
//     do not.
//
// Norwegian store, NOK, no currency conversion. Sale prices are taken from the
// card's .special value, not the struck-through former price.
//
// Run with: pnpm scrape:krokhol

const { runAsScript } = require('./lib/mystore.js');

const BASE = 'https://www.krokholdgs.no';
const CATEGORIES = [
  `${BASE}/categories/putter-disk`,
  `${BASE}/categories/midrange-disk`,
  `${BASE}/categories/fairwaydriver`,
  `${BASE}/categories/driver-disk`,
  `${BASE}/categories/lette-disker`,
];

runAsScript({
  key: 'krokhol',
  name: 'Krokhol Disc Golf Shop',
  baseUrl: BASE,
  categoryUrls: CATEGORIES,
  // krokholdgs.no/pages/shipping: "Pakke i postkassen (Posten): 39 kr",
  // "Pakke til hentested eller større pakker (PostNord): 99 kr", "Hente i Pro
  // Shop: Gratis". A single disc goes in the mailbox, which is what the price
  // comparison models, so 39. No free-shipping threshold is stated anywhere, so
  // freeShippingOver is omitted rather than guessed (same call as Starframe).
  shipping: 39,
  // Pagination is the ?&page=N shape, 200 products per page — the same shape
  // as Frisbeebutikken, so the default selector covers it.
  pageUrl: (page, categoryUrl) => (page <= 1 ? categoryUrl : `${categoryUrl}?&page=${page}`),
});
