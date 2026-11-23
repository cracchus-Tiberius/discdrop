'use strict';

// ── First-seen ledger ────────────────────────────────────────────────────
//
// mergeStoreResults() wipes a store's entries and rebuilds them every run,
// carrying firstSeen across the wipe. It used to carry it ONLY from the
// previous snapshot, keyed by (discId|store|plastic). Two things defeated
// that, every day, for a few hundred listings:
//
//  1. The key's plastic isn't the stored plastic. When a title names no
//     plastic, the merge stores plastic=null and enrich-variants.js fills it
//     in from the URL slug afterwards. Next run the merge looks up "…|null",
//     the snapshot only holds "…|K3 Hard", and the listing is "first seen"
//     today — again. HyzerShop's K3 Hard Berg was new every day for weeks.
//  2. A listing missing from one run loses its history. Frisbeebutikken's
//     scrape reaches between ~305 and ~391 listings depending on the day;
//     whatever came back after a miss restarted at today. On 2026-11-23,
//     83 of its 89 "new" listings had been there on 2026-11-15.
//
// Both made old listings look like new arrivals: discexpress leaked ~29 a
// day onto /nytt's live week (under the mass-reset threshold of 30), while
// HyzerShop's 62 tripped mass-reset daily and took any real HyzerShop drop
// that day down with them.
//
// The ledger is keyed by product URL (with discId and store, so a URL the
// matcher later assigns to another disc doesn't carry the old disc's date)
// and keeps a listing's date for LEDGER_RETENTION_DAYS after it was last
// seen. Neither the plastic nor a missed run can reset it.

const fs = require('fs');

const LEDGER_RETENTION_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

function ledgerKey(discId, store, url) {
  return `${discId}|${store}|${url}`;
}

function loadLedger(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed.entries === 'object' && parsed.entries) return parsed;
    } catch {}
  }
  return { entries: {} };
}

function saveLedger(filePath, ledger) {
  // Sorted keys keep the daily diff to the rows that actually changed.
  const entries = {};
  for (const k of Object.keys(ledger.entries).sort()) entries[k] = ledger.entries[k];
  fs.writeFileSync(filePath, JSON.stringify({ ...ledger, entries }, null, 1));
}

// ISO timestamps compare correctly as strings; this just skips the missing.
function earliest(...dates) {
  let best;
  for (const d of dates) {
    if (d && (best === undefined || d < best)) best = d;
  }
  return best;
}

/**
 * The firstSeen for a listing in this run: the earliest date any source
 * knows of, else `now`.
 * @param {{ledger: object, discId: string, aliasId?: string|null, store: string,
 *          url: string, keyFirstSeen?: string, aliasKeyFirstSeen?: string, now: string}} args
 */
function resolveFirstSeen({ ledger, discId, aliasId, store, url, keyFirstSeen, aliasKeyFirstSeen, now }) {
  const byUrl = url ? ledger.entries[ledgerKey(discId, store, url)] : undefined;
  const byAliasUrl = url && aliasId ? ledger.entries[ledgerKey(aliasId, store, url)] : undefined;
  return earliest(byUrl && byUrl.f, byAliasUrl && byAliasUrl.f, keyFirstSeen, aliasKeyFirstSeen) || now;
}

/** Record that a listing was seen this run with the given firstSeen. */
function recordSeen(ledger, { discId, store, url, firstSeen, now }) {
  if (!url) return;
  const k = ledgerKey(discId, store, url);
  const prev = ledger.entries[k];
  ledger.entries[k] = {
    f: earliest(prev && prev.f, firstSeen) || now,
    l: prev && prev.l && prev.l > now ? prev.l : now,
  };
}

/** Forget listings not seen for LEDGER_RETENTION_DAYS. */
function pruneLedger(ledger, now, retentionDays = LEDGER_RETENTION_DAYS) {
  const cutoff = new Date(new Date(now).getTime() - retentionDays * DAY_MS).toISOString();
  let removed = 0;
  for (const [k, v] of Object.entries(ledger.entries)) {
    if (!v.l || v.l < cutoff) {
      delete ledger.entries[k];
      removed++;
    }
  }
  return removed;
}

module.exports = {
  LEDGER_RETENTION_DAYS,
  ledgerKey,
  loadLedger,
  saveLedger,
  earliest,
  resolveFirstSeen,
  recordSeen,
  pruneLedger,
};
