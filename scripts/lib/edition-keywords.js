'use strict';

// scripts/lib/edition-keywords.js — single source of truth for "does this
// scraped edition string represent a real, notable release" (Tour Series,
// player signature lines, event/tournament runs, limited/prototype runs,
// dated year-stamp releases). Used by BOTH app/disc-drop-home.tsx's Hot
// Drops section and scripts/lib/new-in-stores.js's "Ny drop" signal
// classification — kept in one place so the two features can't quietly
// drift apart on what counts as a notable edition (they used to duplicate
// these lists independently before 2026-08-18).

const TOUR_SERIES_KEYWORDS = [
  'Tour Series', 'Team Series', 'Team Championship Series', 'Signature Series', 'Mold Team',
];

const LIMITED_KEYWORDS = [
  'Limited Edition', 'Special Edition', 'Prototype', 'First Run', 'Primal Run',
  'Project Lab Coat', 'Lab Coat',
];

const HOT_PLAYER_NAMES = [
  'Eagle McMahon', 'Calvin Heimburg', 'Ricky Wysocki', 'Simon Lizotte',
  'Paige Pierce', 'Brodie Smith', 'Paul McBeth', 'Niklas Anttila',
  'Bradley Williams', 'Gannon Buhr', 'Clay Edwards', 'Casey White',
  'Nate Sexton', 'Anthony Barela', 'Catrina Allen', 'Henna Blomroos',
  'Eveliina Salonen', 'Vaino Makela', 'Kristofer Hivju', 'Albert Tamm',
  'Kristin Lätt', 'Kristin Tattar', 'JohnE McCray', 'Dallas Garber',
  'Joseph Anderson', 'Silva Saarinen', 'Sockibomb',
  'Jeremy Koling', 'James Conrad', 'Kona Montgomery',
  'Ida Emilie Nesse', 'Anniken Steen', 'Julia Fors', 'Juliana Korver',
  'Josef Berg', 'Cadence Burge', 'Kyle Klein', 'Aaron Gossage',
  'Holyn Handley', 'Ella Hansen', 'Isaac Robinson',
];

const EVENT_KEYWORDS = [
  'Ledgestone', 'OTB Open', 'Gyropalooza', 'MVP Open', 'USDGC', 'EDGF',
  'World Championship', 'Nordic Phenom', 'Sky Stone', 'Solar Flare', 'Get Freaky', 'Show Stopper',
];

const ALL_EDITION_KEYWORDS = new Set([
  ...TOUR_SERIES_KEYWORDS, ...LIMITED_KEYWORDS, ...HOT_PLAYER_NAMES, ...EVENT_KEYWORDS,
]);

const YEAR_PATTERN = /\b(20\d{2})\b/;

/**
 * Normalizes a raw scraped `edition` string into a canonical, comparable
 * category so differently-worded store listings for the same real-world
 * release ("TS Cloudbreaker 2026" vs "Tour Series Cloudbreaker") collapse
 * to the same value instead of registering as two different editions.
 * Returns null for a plain/unrecognized edition string (nothing notable).
 */
function normalizeEdition(edition) {
  if (!edition) return null;
  const lower = edition.toLowerCase();
  const parts = [];

  if (TOUR_SERIES_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) parts.push('tour-series');
  if (LIMITED_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) parts.push('limited');

  const player = HOT_PLAYER_NAMES.find((p) => lower.includes(p.toLowerCase()));
  if (player) parts.push(player.toLowerCase().replace(/\s+/g, '-'));

  const event = EVENT_KEYWORDS.find((e) => lower.includes(e.toLowerCase()));
  if (event) parts.push(event.toLowerCase().replace(/\s+/g, '-'));

  const yearMatch = lower.match(YEAR_PATTERN);
  if (yearMatch) parts.push(yearMatch[1]);

  if (parts.length === 0) return null;
  // Sorted so key order never matters ("2026 Tour Series" and "Tour Series
  // 2026" normalize identically).
  return [...new Set(parts)].sort().join('|');
}

/** True if `edition` matches any recognized notable-release keyword (used by Hot Drops). */
function isNotableEdition(edition) {
  if (!edition) return false;
  const lower = edition.toLowerCase();
  return [...ALL_EDITION_KEYWORDS].some((kw) => lower.includes(kw.toLowerCase()));
}

module.exports = {
  TOUR_SERIES_KEYWORDS,
  LIMITED_KEYWORDS,
  HOT_PLAYER_NAMES,
  EVENT_KEYWORDS,
  ALL_EDITION_KEYWORDS,
  normalizeEdition,
  isNotableEdition,
};
