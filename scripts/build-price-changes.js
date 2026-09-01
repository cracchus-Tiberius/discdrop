#!/usr/bin/env node
'use strict';

// scripts/build-price-changes.js — Prisfall.
//
// Runs in the daily-scrape GitHub Actions workflow AFTER today's scrape but
// BEFORE the "Commit updated data" step. At that point in the pipeline,
// `git show HEAD:data/scraped-prices.json` still resolves to YESTERDAY's
// committed snapshot, while data/scraped-prices.json on disk is today's
// fresh (uncommitted) scrape — exactly the day-over-day diff we need.
//
// Reconstructs a 7-point daily price history (oldest -> newest, ending
// "today") from the last 6 committed daily snapshots plus today's working
// tree. Walks EVERY consecutive day-pair in that window (not just
// yesterday->today) via scripts/lib/price-changes.js's computeChanges(),
// each gated by the trailing-7-day-minimum rule so a rebound-to-baseline
// never shows up as a fake drop, and tags each with the real calendar date
// it happened on plus which /prisfall group it belongs in (today/
// yesterday/earlier-this-week/last-week). Writes data/price-changes.json.
//
// See design_handoff_prisfall/README.md (Claude Design project "DiscDrop
// Redesign") for the original data-shape spec this file extends.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const { computeChanges, buildHistory, classifyDropBucket } = require('./lib/price-changes');
const { getIsoWeekStart } = require('./lib/new-in-stores');
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
 * One {sha, day} pair per calendar day (the LATEST commit on days with more
 * than one), newest first — collapses the occasional same-day double-commit
 * seen in this repo's history down to one data point per day.
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
  const result = [];
  for (const line of log.split('\n')) {
    const [sha, day] = line.split(' ');
    if (seenDays.has(day)) continue; // keep only the newest commit per day
    seenDays.add(day);
    result.push({ sha, day });
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * Builds the `snapshots` array (oldest -> newest, length up to
 * HISTORY_LENGTH) used both for history sparklines and as the day-pair/
 * week-ago baselines, plus a parallel `dates` array ("YYYY-MM-DD", same
 * order/length) so every drop can be tagged with the real day it happened
 * on. Last element of both is always today's working tree / today's date.
 */
function buildSnapshotWindow() {
  const today = readWorkingTreeSnapshot();
  const todayDate = today.lastUpdated
    ? new Date(today.lastUpdated).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // In the real daily-scrape pipeline this step always runs BEFORE "Commit
  // updated data", so HEAD is guaranteed to still be yesterday's commit —
  // today's own date never appears in git history yet. Excluding it here
  // anyway is a defensive guard for anyone re-running this script by hand
  // AFTER that commit has landed (confirmed locally: HEAD can already have
  // a same-day commit, which would otherwise duplicate "today" and shift
  // every earlier day-pair's date off by one).
  const committed = oneCommitPerDay(HISTORY_LENGTH).filter((c) => c.day !== todayDate).slice(0, HISTORY_LENGTH - 1); // newest first
  const oldestFirst = committed.slice().reverse();
  const committedSnapshots = oldestFirst.map((c) => readCommittedSnapshot(c.sha));

  return {
    snapshots: [...committedSnapshots, today],
    dates: [...oldestFirst.map((c) => c.day), todayDate],
    todayDate,
  };
}

function attachHistory(dropsRaw, snapshots) {
  return dropsRaw
    .map((drop) => ({
      discId: drop.discId,
      store: drop.store,
      storeName: drop.storeName,
      plastic: drop.plastic,
      oldPrice: drop.oldPrice,
      newPrice: drop.newPrice,
      pct: drop.pct,
      date: drop.date,
      bucket: drop.bucket,
      url: drop.url,
      history: buildHistory(drop.discId, snapshots, HISTORY_LENGTH),
    }))
    .filter((d) => d.history);
}

function main() {
  const { snapshots, dates, todayDate } = buildSnapshotWindow();
  const today = snapshots[snapshots.length - 1];
  const storesChecked = Object.keys(today.stores || {}).length;
  const mondayOfThisWeekMs = getIsoWeekStart(new Date(`${todayDate}T00:00:00Z`)).getTime();

  // Every consecutive day-pair in the window, each gated by the trailing
  // minimum across every snapshot strictly before it (not just the
  // immediate prior day) — see computeChanges' doc comment for why: a
  // disc that bumped up yesterday and reverted today isn't a new low just
  // because it's below YESTERDAY specifically.
  let todayChangedCount = 0;
  let todayNewDiscCount = 0;
  const timelineRaw = [];
  for (let i = 1; i < snapshots.length; i++) {
    const result = computeChanges({
      oldSnapshot: snapshots[i - 1],
      newSnapshot: snapshots[i],
      catalog: CATALOG,
      period: 'day',
      trailingSnapshots: snapshots.slice(0, i),
    });
    if (i === snapshots.length - 1) {
      // The final pair (yesterday -> today) is what "N prisendringer i
      // dag" / "N nye disker i dag" on the homepage ticker actually means.
      todayChangedCount = result.changedDiscCount;
      todayNewDiscCount = result.newDiscCount;
    }
    const date = dates[i];
    const bucket = classifyDropBucket(date, todayDate, mondayOfThisWeekMs);
    for (const drop of result.dropsRaw) {
      timelineRaw.push({ ...drop, date, bucket });
    }
  }

  // Week-over-week catch-all ("Forrige uke"): drops whose cumulative move
  // over the whole window clears the bar even though no single day-pair
  // did. Deduped against the day-by-day timeline above — a disc that's
  // already there (a real day-over-day drop) shouldn't also appear as a
  // duplicate "last week" row just because it's also down vs a week ago.
  const weekAgo = snapshots[0];
  const timelineDiscIds = new Set(timelineRaw.map((d) => d.discId));
  let weekResult = { changedDiscCount: 0, newDiscCount: 0, dropsRaw: [] };
  if (weekAgo && weekAgo !== today) {
    weekResult = computeChanges({
      oldSnapshot: weekAgo,
      newSnapshot: today,
      catalog: CATALOG,
      period: 'week',
      trailingSnapshots: snapshots.slice(0, -1),
    });
  }
  const weekCatchUp = weekResult.dropsRaw
    .filter((d) => !timelineDiscIds.has(d.discId))
    .map((d) => ({ ...d, date: todayDate, bucket: 'last-week' }));

  const timeline = attachHistory([...timelineRaw, ...weekCatchUp], snapshots).sort(
    (a, b) => (a.date === b.date ? a.pct - b.pct : b.date.localeCompare(a.date))
  );

  const output = {
    generated: new Date().toISOString(),
    summary: {
      priceChanges24h: todayChangedCount,
      newDiscs24h: todayNewDiscCount,
      storesChecked,
    },
    timeline,
    totalDrops: timeline.length,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  const byBucket = { today: 0, yesterday: 0, 'earlier-this-week': 0, 'last-week': 0 };
  for (const d of timeline) byBucket[d.bucket]++;
  console.log(
    `price-changes.json: ${todayChangedCount} price changes today, ${todayNewDiscCount} new discs, ` +
      `${storesChecked} stores checked, ${timeline.length} drops total ` +
      `(today ${byBucket.today}, yesterday ${byBucket.yesterday}, earlier this week ${byBucket['earlier-this-week']}, last week ${byBucket['last-week']}).`
  );
}

main();
