'use strict';
// TEMPORARY CI probe — removed before merge. Runs the real attempt-1 path
// (scrapeCategoryWithHeaders, with the multi-pass shift check) against
// Frisbeebutikken three times back to back, to show the count is stable.
const { scrapeCategoryWithHeaders } = require('../lib/mystore.js');

const CATEGORY_URL = 'https://frisbeebutikken.no/categories/golfdisker';
const store = { key: 'frisbeebutikken', pageUrl: (p) => (p <= 1 ? CATEGORY_URL : `${CATEGORY_URL}?&page=${p}`) };

(async () => {
  const counts = [];
  for (let run = 1; run <= 3; run++) {
    console.log(`=== run ${run} ===`);
    const r = await scrapeCategoryWithHeaders(store, CATEGORY_URL);
    console.log(`RESULT run ${run}: ${r ? `${r.products.length} distinct, ${r.passes} pass(es), largest pass ${r.rows} rows, shortfall ${r.shortfall}` : 'aborted'}`);
    counts.push(r ? r.products.length : null);
  }
  console.log(`SUMMARY: ${counts.join(' / ')}`);
})().catch((e) => { console.error(e); process.exit(1); });
