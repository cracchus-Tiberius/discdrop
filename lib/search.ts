// lib/search.ts — ranking logic for the live search dropdown
// (components/SearchInput.tsx). Pure and framework-agnostic (no fs, no
// Next.js imports) so it's directly unit-testable, same separation as
// scripts/lib/*.js's pure-computation modules.
//
// Field priority, highest to lowest: disc name prefix > disc name
// substring > brand prefix > brand substring > plastic/player substring.
// Confirmed in production: without this, a 2-character query like "ec"
// matched "Recycled ESP" (a plastic line) as readily as any disc name,
// burying real name matches under plastic noise for every disc sold in
// that plastic.

export type SearchableDisc = {
  id: string;
  name: string;
  brand: string;
  plastics: string[];
  player?: string | null;
};

export type SearchMatchField = "name" | "brand" | "plastic" | "player";

export type SearchResult<T extends SearchableDisc> = {
  disc: T;
  score: number;
  matchedField: SearchMatchField;
  /** Which plastic matched, only set when matchedField === "plastic" — same purpose as the old matchedPlastic hint. */
  matchedPlastic: string | null;
  /** Start index of the match within the matched field's ORIGINAL (non-normalized) text, for highlighting. */
  matchStart: number;
  matchLength: number;
};

// Below this query length, plastic/player matching is disabled entirely —
// short queries (1-2 chars) are common substrings of many plastic names
// ("ec" in "Recycled", "el" in "Electron"), so allowing them there buries
// genuine name/brand matches under noise. Name and brand prefix matching
// still works at any length, including 1 character.
const MIN_QUERY_LENGTH_FOR_PLASTIC_PLAYER = 3;

const SCORE = {
  namePrefix: 100,
  nameSubstring: 80,
  brandPrefix: 60,
  brandSubstring: 40,
  plasticOrPlayer: 20,
};

// å (unlike æ/ø) DOES have an NFD decomposition — U+00E5 -> "a" + COMBINING
// RING ABOVE (U+030A), since Unicode models it as a diacritic mark for
// compatibility with other scripts that reuse the ring-above accent.
// Naively decompose-and-strip would silently turn "å" into "a", merging
// two distinct Norwegian letters. Swapped out for a placeholder before
// normalizing and swapped back after, so it survives untouched alongside
// æ/ø (which need no such protection — they have no decomposition at all).
const A_RING_PLACEHOLDER = "\u0001";

/** Lowercases and strips diacritics (é -> e) while leaving æ/ø/å genuinely untouched. */
export function normalizeSearchText(s: string): string {
  return s
    .replace(/[åÅ]/g, A_RING_PLACEHOLDER)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(new RegExp(A_RING_PLACEHOLDER, "g"), "å")
    .toLowerCase();
}

function findMatch(haystack: string, needle: string): { start: number; length: number } | null {
  const normHaystack = normalizeSearchText(haystack);
  const idx = normHaystack.indexOf(needle);
  if (idx === -1) return null;
  // needle.length is used directly rather than re-measuring against the
  // original string — normalizeSearchText only ever removes combining marks
  // (never adds characters), so for the realistic catalog (occasional
  // single-accent Latin names, no multi-mark stacking) this stays aligned
  // with the original text's own indices closely enough for highlighting.
  return { start: idx, length: needle.length };
}

/**
 * Ranked search results for `query` against `discs`. Empty query returns
 * an empty array — the caller decides what to show pre-search.
 */
export function searchDiscs<T extends SearchableDisc>(query: string, discs: T[]): SearchResult<T>[] {
  const q = normalizeSearchText(query.trim());
  if (!q) return [];
  const allowPlasticPlayer = q.length >= MIN_QUERY_LENGTH_FOR_PLASTIC_PLAYER;

  const results: SearchResult<T>[] = [];

  for (const disc of discs) {
    const nameMatch = findMatch(disc.name, q);
    const normName = normalizeSearchText(disc.name);

    if (nameMatch) {
      const isPrefix = normName.startsWith(q);
      results.push({
        disc,
        score: isPrefix ? SCORE.namePrefix : SCORE.nameSubstring,
        matchedField: "name",
        matchedPlastic: null,
        matchStart: nameMatch.start,
        matchLength: nameMatch.length,
      });
      continue;
    }

    const brandMatch = findMatch(disc.brand, q);
    if (brandMatch) {
      const normBrand = normalizeSearchText(disc.brand);
      const isPrefix = normBrand.startsWith(q);
      results.push({
        disc,
        score: isPrefix ? SCORE.brandPrefix : SCORE.brandSubstring,
        matchedField: "brand",
        matchedPlastic: null,
        matchStart: brandMatch.start,
        matchLength: brandMatch.length,
      });
      continue;
    }

    if (!allowPlasticPlayer) continue;

    const plastic = disc.plastics.find((p) => normalizeSearchText(p).includes(q));
    if (plastic) {
      const plasticMatch = findMatch(plastic, q)!;
      results.push({
        disc,
        score: SCORE.plasticOrPlayer,
        matchedField: "plastic",
        matchedPlastic: plastic,
        matchStart: plasticMatch.start,
        matchLength: plasticMatch.length,
      });
      continue;
    }

    if (disc.player && normalizeSearchText(disc.player).includes(q)) {
      const playerMatch = findMatch(disc.player, q)!;
      results.push({
        disc,
        score: SCORE.plasticOrPlayer,
        matchedField: "player",
        matchedPlastic: null,
        matchStart: playerMatch.start,
        matchLength: playerMatch.length,
      });
    }
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    // Within the same tier, a shorter (closer to exact) name ranks first —
    // this is what puts "Berg" ahead of "Berg X" ahead of "Iceberg" for
    // query "berg", not just insertion order.
    if (a.disc.name.length !== b.disc.name.length) return a.disc.name.length - b.disc.name.length;
    return a.disc.name.localeCompare(b.disc.name, "nb");
  });

  return results;
}
