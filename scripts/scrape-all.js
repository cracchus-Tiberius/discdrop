#!/usr/bin/env node
// scripts/scrape-all.js — resilient scrape:all wrapper
// Runs each scraper in sequence with a per-scraper timeout.
// One failure does NOT stop the rest — all scrapers run, then deploy happens.
'use strict';

const { execSync } = require('child_process');

const TIMEOUT_MS = 10 * 60 * 1000; // 10 min per scraper

const STEPS = [
  { name: 'WeAreDiscGolf / Kvam / Arctic',  cmd: 'node scripts/scraper.js' },
  { name: 'Aceshop',                         cmd: 'node scripts/scrape-aceshop.js' },
  { name: 'Frisbeebutikken',                 cmd: 'node scripts/scrape-frisbeebutikken.js' },
  { name: 'GolfDiscer',                      cmd: 'node scripts/scrape-golfdiscer.js' },
  { name: 'Frisbee Sør',                     cmd: 'node scripts/scrape-frisbeesor.js' },
  { name: 'Discexpress',                     cmd: 'node scripts/scrape-discexpress.js' },
  { name: 'Rocketdiscs',                     cmd: 'node scripts/scrape-rocketdiscs.js' },
  { name: 'Fetch images',                    cmd: 'node scripts/fetch-images.js' },
  { name: 'Enrich variants',                 cmd: 'node scripts/enrich-variants.js' },
];

const failed = [];

for (const { name, cmd } of STEPS) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`▶  ${name}`);
  console.log('='.repeat(60));
  try {
    execSync(cmd, { stdio: 'inherit', timeout: TIMEOUT_MS });
    console.log(`✓  ${name} done`);
  } catch (err) {
    const reason = err.signal === 'SIGTERM' ? 'timed out after 10 min' : err.message.split('\n')[0];
    console.error(`✗  ${name} failed: ${reason}`);
    failed.push(name);
  }
}

console.log('\n' + '='.repeat(60));
if (failed.length === 0) {
  console.log('✓  All scrapers completed successfully');
} else {
  console.error(`⚠  ${failed.length} scraper(s) failed: ${failed.join(', ')}`);
  console.error('   Deploy will still proceed with whatever data was collected.');
}
console.log('='.repeat(60));

process.exit(0); // Always exit 0 so build + deploy continue
