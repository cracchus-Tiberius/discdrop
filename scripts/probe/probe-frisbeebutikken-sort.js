'use strict';
// TEMPORARY CI probe — removed before merge. Answers, from a GitHub runner:
//   1. which sort options Frisbeebutikken's category page links to,
//   2. whether two passes over the default order overlap/disagree,
//   3. whether a pinned /sort-by/N/ order gives disjoint pages.
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { parseListing } = require('../lib/mystore.js');

const BASE = 'https://frisbeebutikken.no/categories/golfdisker';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'nb-NO,nb;q=0.9' }, timeout: 20000 });
  const html = await res.text();
  return { status: res.status, finalUrl: res.url, html };
}

async function pass(label, pageUrl) {
  const seen = new Set();
  let rows = 0;
  const pages = [];
  const p1 = await get(pageUrl(1));
  let { products, maxPage } = parseListing(p1.html, {});
  for (let page = 1; page <= maxPage; page++) {
    if (page > 1) {
      await sleep(1500);
      const r = await get(pageUrl(page));
      if (r.status !== 200) { pages.push(`p${page}:HTTP${r.status}`); break; }
      products = parseListing(r.html, {}).products;
    }
    let dup = 0;
    for (const p of products) { rows++; if (seen.has(p.productUrl)) dup++; else seen.add(p.productUrl); }
    pages.push(`p${page}:${products.length}/dup${dup}`);
  }
  console.log(`[${label}] status=${p1.status} final=${p1.finalUrl} maxPage=${maxPage} rows=${rows} unique=${seen.size} :: ${pages.join(' ')}`);
  return seen;
}

(async () => {
  const { html } = await get(BASE);
  const $ = cheerio.load(html);
  const hrefs = new Set();
  $('a[href], option[value]').each((_, el) => {
    const v = $(el).attr('href') || $(el).attr('value') || '';
    if (/sort|order|page|limit|per/i.test(v)) hrefs.add(`${v}  ::  ${$(el).text().trim().slice(0, 40)}`);
  });
  console.log('--- sort/pagination links on page 1 ---');
  for (const h of hrefs) console.log('  ' + h);
  const selects = $('select').map((_, s) => $(s).attr('name') + ': ' + $(s).find('option').map((_, o) => `${$(o).attr('value')}=${$(o).text().trim()}`).get().join(' | ')).get();
  console.log('--- selects ---\n  ' + selects.join('\n  '));
  const sortMentions = (html.match(/.{0,80}sort[-_]?by.{0,80}/gi) || []).slice(0, 15);
  console.log('--- "sort-by" mentions ---\n  ' + sortMentions.join('\n  '));

  const def = (p) => (p <= 1 ? BASE : `${BASE}?&page=${p}`);
  const a = await pass('default #1', def);
  const b = await pass('default #2', def);
  const c = await pass('default #3', def);
  const union = new Set([...a, ...b, ...c]);
  console.log(`default union of 3 passes: ${union.size}`);

  for (const n of [1, 2, 3, 4, 5, 6]) {
    const shape = (p) => `${BASE}/sort-by/${n}/` + (p <= 1 ? '' : `?page=${p}`);
    const x = await pass(`sort-by/${n} #1`, shape);
    const y = await pass(`sort-by/${n} #2`, shape);
    const both = [...x].filter((u) => y.has(u)).length;
    const missingFromUnion = [...union].filter((u) => !x.has(u)).length;
    console.log(`  sort-by/${n}: pass-agreement ${both}/${Math.max(x.size, y.size)}, union-of-default not in pass1: ${missingFromUnion}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
