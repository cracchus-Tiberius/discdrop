#!/usr/bin/env node
// scripts/scrape-all.js — resilient scrape:all wrapper
// Runs each scraper in sequence with a per-scraper timeout.
// One failure does NOT stop the rest — all scrapers run, then deploy happens.
//
// IMPORTANT: uses spawn() with a detached process group, not execSync().
// execSync's `timeout` option only SIGTERMs the immediate shell child — the
// actual `node scripts/x.js` process it launches survives as an orphaned
// zombie that keeps running (and writing to scraped-prices.json) *while
// later steps run too*. That caused real data races and resource contention
// that looked like unrelated store failures. spawn+detached lets us kill the
// whole process group, so a timed-out step is actually gone before the next
// one starts.
'use strict';

const { spawn } = require('child_process');

const TIMEOUT_MS = 10 * 60 * 1000; // 10 min per scraper

const STEPS = [
  { name: 'WeAreDiscGolf / Kvam / Arctic',  cmd: 'node scripts/scraper.js' },
  { name: 'Aceshop',                         cmd: 'node scripts/scrape-aceshop.js' },
  { name: 'Frisbeebutikken',                 cmd: 'node scripts/scrape-frisbeebutikken.js' },
  { name: 'GolfDiscer',                      cmd: 'node scripts/scrape-golfdiscer.js' },
  { name: 'Frisbee Sør',                     cmd: 'node scripts/scrape-frisbeesor.js' },
  { name: 'Discexpress',                     cmd: 'node scripts/scrape-discexpress.js' },
  { name: 'Rocketdiscs',                     cmd: 'node scripts/scrape-rocketdiscs.js' },
  { name: 'Discsport',                       cmd: 'node scripts/scrape-discsport.js' },
  { name: 'Fetch images',                    cmd: 'node scripts/fetch-images.js' },
  { name: 'Enrich variants',                 cmd: 'node scripts/enrich-variants.js' },
];

function runStep(cmd) {
  return new Promise((resolve) => {
    const [bin, ...args] = cmd.split(' ');
    const child = spawn(bin, args, { stdio: 'inherit', detached: true });

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL'); // negative pid = whole process group
      } catch (_) {}
    }, TIMEOUT_MS);

    child.on('exit', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) resolve({ ok: false, reason: 'timed out after 10 min' });
      else if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, reason: `exited with code ${code}${signal ? ` (${signal})` : ''}` });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, reason: err.message });
    });
  });
}

async function main() {
  const failed = [];

  for (const { name, cmd } of STEPS) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`▶  ${name}`);
    console.log('='.repeat(60));
    const result = await runStep(cmd);
    if (result.ok) {
      console.log(`✓  ${name} done`);
    } else {
      console.error(`✗  ${name} failed: ${result.reason}`);
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
}

main().then(() => process.exit(0)); // Always exit 0 so build + deploy continue
