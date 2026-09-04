'use strict';

// scripts/scrape-frisbeebutikken.js — Frisbeebutikken (frisbeebutikken.no).
//
// Mystore platform: all the scraping logic lives in scripts/lib/mystore.js,
// shared with Starframe and Krokhol. This file is only the store's config.
//
// History worth keeping: the site was rebuilt (confirmed 2026-08-04) and
// silently broke the scraper — no HTTP errors, it just quietly returned 0
// products every day once the old [data-price-including-tax] markup went away.
// Product data moved into each card's addToCart() Alpine.js handler, which is
// what the shared parser reads now.
//
// The category listing appears to only show in-stock items (no "utsolgt"
// markers found anywhere across 4 sample pages), so inStock is always true for
// this store — if that assumption turns out wrong, prices for genuinely
// out-of-stock discs would incorrectly show as available.
//
// Run with: pnpm scrape:frisbeebutikken

const { runAsScript } = require('./lib/mystore.js');

const CATEGORY_URL = 'https://frisbeebutikken.no/categories/golfdisker';

runAsScript({
  key: 'frisbeebutikken',
  name: 'Frisbeebutikken',
  baseUrl: 'https://frisbeebutikken.no',
  categoryUrl: CATEGORY_URL,
  shipping: 45,
  freeShippingOver: 699,
  // ~100 products per page. This part of the site was NOT changed by the 2026
  // rebuild — still plain <a href="?&page=N"> links.
  pageUrl: (page) => (page <= 1 ? CATEGORY_URL : `${CATEGORY_URL}?&page=${page}`),
});
