'use strict';

// scripts/scrape-starframe.js — Starframe (Hamar, starframe.no).
//
// Mystore platform, same as Frisbeebutikken and Krokhol: all the scraping
// logic lives in scripts/lib/mystore.js. This file is only the store's config.
//
// The /categories/typer listing is disc-only — every sampled product carries
// category: 'Discer'. No "utsolgt"/out-of-stock markers were found in sampled
// pages, so inStock is always true for this store (same caveat as
// Frisbeebutikken).
//
// Shipping: "frakt fra 50 kr eller gratis henting i Hamar" (starframe.no) — no
// confirmed free-shipping-over threshold, so freeShippingOver is intentionally
// omitted rather than guessed.
//
// Run with: pnpm scrape:starframe

const { runAsScript } = require('./lib/mystore.js');

const CATEGORY_URL = 'https://www.starframe.no/categories/typer';

runAsScript({
  key: 'starframe',
  name: 'Starframe',
  baseUrl: 'https://www.starframe.no',
  categoryUrl: CATEGORY_URL,
  shipping: 50,
  // Page 1 is the bare category URL; page N (N>=2) is
  // /categories/typer/sort-by/1/?page=N — a different URL shape from
  // Frisbeebutikken's ?&page=N, but the same underlying page-number param.
  pageUrl: (page) => (page <= 1 ? CATEGORY_URL : `${CATEGORY_URL}/sort-by/1/?page=${page}`),
  paginationSelector: 'a[href*="?page="]',
});
