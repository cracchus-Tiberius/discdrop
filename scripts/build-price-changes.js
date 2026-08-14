#!/usr/bin/env node
'use strict';

// scripts/build-price-changes.js — Prisfall Fase 1.
//
// Runs in the daily-scrape GitHub Actions workflow AFTER today's scrape but
// BEFORE the "Commit updated data" step. At that point in the pipeline,
// `git show HEAD:data/scraped-prices.json` still resolves to YESTERDAY's
// committed snapshot, while data/scraped-prices.json on disk is today's
// fresh (uncommitted) scrape — exactly the day-over-day diff we need.
//
// Reconstructs a 7-point daily price history (oldest -> newest, ending
// "today") from the last 6 committed daily snapshots plus today's working
// tree, computes day-over-day and week-over-week price drops per disc via
// scripts/lib/price-changes.js, and writes data/price-changes.json.
//
// See design_handoff_prisfall/README.md (Claude Design project "DiscDrop
// Redesign") for the full data-shape spec this file implements.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { computeChanges, buildHistory } = require('./lib/price-changes');
const { discs: SOURCE_DISCS } = require('../data/discs.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRAPED_PRICES_PATH = path.join(REPO_ROOT, 'data', 'scraped-prices.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'data', 'price-changes.json');
const RELATIVE_SCRAPED_PATH = 'data/scraped-prices.json';

const HISTORY_LENGTH = 7; // 6 committed daily snapshots + today's working tree

const CATALOG = SOURCE_DISCS.map(({ id, brand }) => ({ id, brand }));

// data/scraped-prices.json is well over 1MB (execFileSync's default
// maxBuffer), so raise it — 64MB comfortably covers the catalog's growth.
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
}

function readWorkingTreeSnapshot() {
  return JSON.parse(fs.readFileSync(SCRAPED_PRICES_PATH, 'utf8'));
}

function readCommittedSnapshot(sha) {
  const raw = git(['show', `${sha}:${RELATIVE_SCRAPED_PATH}`]);
  return JSON.parse(raw);
}

/**
 * One commit SHA per calendar day (the LATEST commit on days with more than
 * one), newest first — collapses the occasional same-day double-commit seen
 * in this repo's history down to one data point per day.
 */
function oneCommitPerDay(limit) {
  const log = git([
    'log',
    '--format=%H %ad',
    '--date=short',
    '--',
    RELATIVE_SCRAPED_PATH,
  ]).trim();
  if (!log) return [];

  const seenDays = new Set();
  const shas = [];
  for (const line of log.split('\n')) {
    const [sha, day] = line.split(' ');
    if (seenDays.has(day)) continue; // keep only the newest commit per day
    seenDays.add(day);
    shas.push(sha);
    if (shas.length >= limit) break;
  }
  return shas;
}

/**
 * Builds the `snapshots` array (oldest -> newest, length up to
 * HISTORY_LENGTH) used both for history sparklines and as the week-ago
 * baseline. Last element is always today's working tree.
 */
function buildSnapshotWindow() {
  const committedShas = oneCommitPerDay(HISTORY_LENGTH - 1); // newest first
  const committedSnapshots = committedShas
    .slice()
    .reverse() // oldest -> newest
    .map(readCommittedSnapshot);
  const today = readWorkingTreeSnapshot();
  return { snapshots: [...committedSnapshots, today], committedShas };
}

function buildDropEntries(dropsRaw, snapshots) {
  return dropsRaw.map((drop) => ({
    discId: drop.discId,
    store: drop.store,
    storeName: drop.storeName,
    plastic: drop.plastic,
    oldPrice: drop.oldPrice,
    newPrice: drop.newPrice,
    pct: drop.pct,
    changedAt: drop.changedAt,
    period: drop.period,
    history: buildHistory(drop.discId, snapshots, HISTORY_LENGTH),
    url: drop.url,
  }));
}

function main() {
  const { snapshots, committedShas } = buildSnapshotWindow();
  const today = snapshots[snapshots.length - 1];
  const yesterday = committedShas.length > 0 ? readCommittedSnapshot(committedShas[0]) : null;
  const weekAgo = snapshots[0]; // oldest point in the window; same snapshot used for history

  const storesChecked = Object.keys(today.stores || {}).length;

  const dayResult = yesterday
    ? computeChanges({ oldSnapshot: yesterday, newSnapshot: today, catalog: CATALOG, period: 'day' })
    : { changedDiscCount: 0, newDiscCount: 0, dropsRaw: [] };

  const weekResult =
    weekAgo && weekAgo !== today
      ? computeChanges({ oldSnapshot: weekAgo, newSnapshot: today, catalog: CATALOG, period: 'week' })
      : { changedDiscCount: 0, newDiscCount: 0, dropsRaw: [] };

  const dayDrops = buildDropEntries(dayResult.dropsRaw, snapshots).filter((d) => d.history);
  const weekDrops = buildDropEntries(weekResult.dropsRaw, snapshots).filter((d) => d.history);

  // Full sorted (uncapped) drops for both periods are written to the file —
  // the /prisfall ranked list and the "Se alle X" totals need every drop.
  // The homepage grid's per-brand cap (capPerBrand(), same pattern as
  // buildHotDropRows()/buildLatestDropRows() in app/disc-drop-home.tsx) is
  // a Fase 2 UI-selection concern, applied at render time, not baked in here.

  const output = {
    generated: new Date().toISOString(),
    summary: {
      priceChanges24h: dayResult.changedDiscCount,
      newDiscs24h: dayResult.newDiscCount,
      storesChecked,
    },
    drops: [...dayDrops, ...weekDrops],
    totalDrops: dayDrops.length,
    totalDropsWeek: weekDrops.length,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(
    `price-changes.json: ${dayResult.changedDiscCount} price changes today, ` +
      `${dayResult.newDiscCount} new discs, ${storesChecked} stores checked, ` +
      `${dayDrops.length} drops today (>=5%), ${weekDrops.length} drops this week.`
  );
}

main();
