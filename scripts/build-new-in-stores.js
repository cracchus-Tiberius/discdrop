#!/usr/bin/env node
'use strict';

// scripts/build-new-in-stores.js — "Nytt i butikk" feature.
//
// Runs in the daily-scrape GitHub Actions workflow after today's scrape,
// alongside build-price-changes.js. Unlike that script, this one only needs
// TODAY's scraped-prices.json — see scripts/lib/new-in-stores.js's header
// comment for why (firstSeen is already tracked per (discId|store|plastic)
// and never touched once set, so a single snapshot is enough to classify
// what's new).
//
// Writes one file per ISO week to data/new-in-stores/2026-W35.json (every
// recent listing classified as new-disc / new-release / new-at-store), plus
// data/new-in-stores/_meta.json (cross-week observability: which week is
// live, quarantine/suppression logs). A week's file is written ONCE, the
// first run after that week ends — see scripts/lib/new-in-stores.js's
// "Week freezing" section for why re-running the classifier later would
// otherwise silently change a past week's numbers. Pass
// --force-refreeze=2026-W35[,2026-W34] to deliberately rewrite an
// already-frozen week (for a genuine bug fix only — not routine use), or
// --force-refreeze-all to rewrite every currently-frozen week.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { buildNewInStoresSignals, groupSignalsByWeek, isoWeekKey, partitionWeeksForFreezing, SIGNAL_WINDOW_MS } = require('./lib/new-in-stores');
const { discs: SOURCE_DISCS } = require('../data/discs.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRAPED_PRICES_PATH = path.join(REPO_ROOT, 'data', 'scraped-prices.json');
const WEEKS_DIR = path.join(REPO_ROOT, 'data', 'new-in-stores');
const META_PATH = path.join(WEEKS_DIR, '_meta.json');
const WEEK_FILE_RE = /^(\d{4}-W\d{2})\.json$/;
const RELATIVE_DISCS_PATH = 'data/discs.js';
const GIT_MAX_BUFFER = 16 * 1024 * 1024;

const CATALOG = SOURCE_DISCS.map(({ id, name, brand, image, catalogAddedAt }) => ({ id, name, brand, image, catalogAddedAt }));

/** Every disc id literally present in a discs.js source string — a plain regex match, not a full eval, so it's safe on arbitrary historical revisions of the file. */
function extractDiscIds(discsJsSource) {
  const ids = new Set();
  const re = /\{\s*id:"([^"]+)"/g;
  let m;
  while ((m = re.exec(discsJsSource))) ids.add(m[1]);
  return ids;
}

/**
 * Disc ids already in data/discs.js as of `dateIso` — the git-history half
 * of the new-disc-catalog check (see scripts/lib/new-in-stores.js's
 * isGenuinelyNewToCatalog). Falls back to the CURRENT catalog's ids (i.e.
 * every id currently in discs.js) if git lookup fails for any reason —
 * that's the conservative direction: it suppresses new-disc detection
 * entirely for this run rather than risk reverting to the false-positive
 * bug this whole mechanism exists to fix.
 */
function catalogIdsAsOf(dateIso) {
  try {
    const sha = execFileSync(
      'git',
      ['log', '--before', dateIso, '-1', '--format=%H', '--', RELATIVE_DISCS_PATH],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER }
    ).trim();
    if (!sha) return new Set(CATALOG.map((d) => d.id)); // no history that far back — treat everything current as "already existed"
    const source = execFileSync('git', ['show', `${sha}:${RELATIVE_DISCS_PATH}`], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER,
    });
    return extractDiscIds(source);
  } catch (err) {
    console.warn(`  Could not read discs.js history for the new-disc catalog check (${err.message}) — suppressing new-disc detection this run as a conservative fallback.`);
    return new Set(CATALOG.map((d) => d.id));
  }
}

function parseForceRefreezeArgs(argv) {
  if (argv.includes('--force-refreeze-all')) return { all: true, weeks: new Set() };
  const flag = argv.find((a) => a.startsWith('--force-refreeze='));
  if (!flag) return { all: false, weeks: new Set() };
  const weeks = flag.slice('--force-refreeze='.length).split(',').map((s) => s.trim()).filter(Boolean);
  return { all: false, weeks: new Set(weeks) };
}

/** Reads every already-written week file's {isoWeek, frozen} — cheap, no signals parsing needed for the freeze decision. */
function readExistingWeekStates() {
  if (!fs.existsSync(WEEKS_DIR)) return new Map();
  const states = new Map();
  for (const filename of fs.readdirSync(WEEKS_DIR)) {
    const match = WEEK_FILE_RE.exec(filename);
    if (!match) continue;
    const week = JSON.parse(fs.readFileSync(path.join(WEEKS_DIR, filename), 'utf8'));
    states.set(match[1], { frozen: !!week.frozen });
  }
  return states;
}

function main() {
  const { all: forceAll, weeks: forceWeeksArg } = parseForceRefreezeArgs(process.argv.slice(2));
  const snapshot = JSON.parse(fs.readFileSync(SCRAPED_PRICES_PATH, 'utf8'));

  // Prefer the snapshot's own lastUpdated over the wall clock so re-running
  // this script against the same data always produces the same output.
  const asOfMs = snapshot.lastUpdated ? new Date(snapshot.lastUpdated).getTime() : Date.now();
  const currentIsoWeek = isoWeekKey(asOfMs);

  fs.mkdirSync(WEEKS_DIR, { recursive: true });
  const existingStates = readExistingWeekStates();
  const frozenIsoWeeks = new Set([...existingStates].filter(([, s]) => s.frozen).map(([isoWeek]) => isoWeek));
  const forceRefreezeIsoWeeks = forceAll ? frozenIsoWeeks : forceWeeksArg;

  const oldCatalogIds = catalogIdsAsOf(new Date(asOfMs - SIGNAL_WINDOW_MS).toISOString());

  const { signals, quarantinedStores, massResetEvents, weeklyCapEvents } = buildNewInStoresSignals({
    snapshot,
    catalog: CATALOG,
    asOfMs,
    oldCatalogIds,
  });
  const weeks = groupSignalsByWeek(signals);

  const { toWrite, toSkip } = partitionWeeksForFreezing({
    weeks,
    currentIsoWeek,
    frozenIsoWeeks,
    forceRefreezeIsoWeeks,
  });

  const generatedAt = new Date().toISOString();
  for (const week of toWrite) {
    const filePath = path.join(WEEKS_DIR, `${week.isoWeek}.json`);
    const body = { ...week, generated: generatedAt };
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2) + '\n');
  }

  // Rebuild the week index from EVERY file now on disk, not just this run's
  // toWrite — a frozen week from a month ago may have aged out of
  // SIGNAL_WINDOW_MS entirely and no longer appear in `weeks` above, but its
  // file (and its slot in the index) must still be there.
  const weekIndex = [];
  for (const filename of fs.readdirSync(WEEKS_DIR)) {
    const match = WEEK_FILE_RE.exec(filename);
    if (!match) continue;
    const week = JSON.parse(fs.readFileSync(path.join(WEEKS_DIR, filename), 'utf8'));
    weekIndex.push({
      isoWeek: week.isoWeek,
      year: week.year,
      weekNumber: week.weekNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      frozen: !!week.frozen,
    });
  }
  weekIndex.sort((a, b) => b.isoWeek.localeCompare(a.isoWeek));

  const counts = { 'new-disc': 0, 'new-release': 0, 'new-at-store': 0 };
  for (const s of signals) counts[s.type]++;

  const meta = {
    generated: generatedAt,
    currentIsoWeek,
    summary: {
      totalSignals: signals.length,
      newDiscs: counts['new-disc'],
      newReleases: counts['new-release'],
      newAtStore: counts['new-at-store'],
      weeksIncluded: weeks.length,
      quarantinedStores,
      // Store+date combos where a scraper/matching-logic change reset
      // firstSeen for a suspiciously large batch of listings at once — see
      // MASS_RESET_THRESHOLD's comment in scripts/lib/new-in-stores.js.
      // Logged here (not just console output) so anyone looking at the JSON
      // later can see what got filtered and why, without re-running this.
      suppressedMassResetEvents: massResetEvents,
      // Store+ISO-week combos where a single store's new-at-store signals
      // exceeded WEEKLY_NEW_AT_STORE_CAP — see that constant's comment in
      // scripts/lib/new-in-stores.js. new-disc/new-release are never capped.
      suppressedWeeklyCapEvents: weeklyCapEvents,
    },
    weeks: weekIndex,
  };
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n');

  console.log(
    `new-in-stores: ${signals.length} signals (${counts['new-disc']} new-disc, ` +
      `${counts['new-release']} new-release, ${counts['new-at-store']} new-at-store) ` +
      `across ${weeks.length} computed week(s). Quarantined stores: ${quarantinedStores.join(', ') || 'none'}.`
  );
  console.log(`Live week: ${currentIsoWeek}. Written: ${toWrite.map((w) => w.isoWeek).join(', ') || 'none'}.`);
  if (toSkip.length > 0) {
    console.log(`Skipped (already frozen): ${toSkip.join(', ')}.`);
  }
  if (massResetEvents.length > 0) {
    console.log('Suppressed mass-reset events (scraper/matching churn, not real news):');
    for (const e of massResetEvents) {
      console.log(`  ${e.store} ${e.date}: ${e.count} listings suppressed`);
    }
  }
  if (weeklyCapEvents.length > 0) {
    console.log('Suppressed weekly new-at-store caps (routine restocking noise, not real news):');
    for (const e of weeklyCapEvents) {
      console.log(`  ${e.store} ${e.isoWeek}: ${e.count} new-at-store signals suppressed`);
    }
  }
}

main();
