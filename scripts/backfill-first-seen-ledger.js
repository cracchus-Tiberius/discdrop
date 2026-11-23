'use strict';
/**
 * One-off: build data/first-seen-ledger.json from every committed snapshot
 * of data/scraped-prices.json.
 *
 * The ledger (scripts/lib/first-seen-ledger.js) only knows what it has
 * recorded, so on its first run it would inherit today's firstSeen for the
 * ~130 listings a day that the old carry-forward was resetting. Git history
 * remembers what the snapshot forgot: the earliest date each URL was ever
 * stored with, which for a listing reset daily is the first day it appeared.
 *
 * Needs full history (git fetch --unshallow). Run: node scripts/backfill-first-seen-ledger.js
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { ledgerKey, earliest, pruneLedger, saveLedger } = require('./lib/first-seen-ledger.js');

const ROOT = path.join(__dirname, '..');
const FILE = 'data/scraped-prices.json';
const git = (args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 1 << 30, encoding: 'utf8' });

if (git(['rev-parse', '--is-shallow-repository']).trim() === 'true') {
  console.error('Shallow clone: run `git fetch --unshallow` first, or the ledger starts from a partial history.');
  process.exit(1);
}

const commits = git(['log', '--reverse', '--format=%H %cI', 'HEAD', '--', FILE]).trim().split('\n');
const ledger = { entries: {} };
const noFirstSeen = {};
let latest;

for (const line of commits) {
  const [sha, committedAt] = line.split(' ');
  let snapshot;
  try {
    snapshot = JSON.parse(git(['show', `${sha}:${FILE}`]));
  } catch {
    continue; // a commit that deleted or broke the file
  }
  const fallback = new Date(committedAt).toISOString();
  for (const [discId, entries] of Object.entries(snapshot.prices || {})) {
    for (const e of entries) {
      if (!e.url || !e.store) continue;
      const k = ledgerKey(discId, e.store, e.url);
      const seen = e.lastScraped || fallback;
      const prev = ledger.entries[k];
      ledger.entries[k] = {
        f: earliest(prev && prev.f, e.firstSeen),
        l: prev && prev.l > seen ? prev.l : seen,
      };
      // Snapshots from before firstSeen existed (March-July) only say the
      // listing was there. Using them would move thousands of dates the
      // carry-forward never got wrong; they count only for a URL that never
      // had a firstSeen at all.
      if (!e.firstSeen) noFirstSeen[k] = earliest(noFirstSeen[k], e.lastScraped, fallback);
    }
  }
  if (snapshot.lastUpdated) latest = snapshot.lastUpdated;
}

for (const [k, v] of Object.entries(ledger.entries)) {
  if (!v.f) v.f = noFirstSeen[k];
}

const total = Object.keys(ledger.entries).length;
const pruned = pruneLedger(ledger, latest);
saveLedger(path.join(ROOT, 'data', 'first-seen-ledger.json'), ledger);
console.log(`${commits.length} snapshots, ${total} listings, ${pruned} pruned (unseen ${'>'}60 days before ${latest}), ${total - pruned} kept.`);
