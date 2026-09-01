// lib/pluralize.ts — Norwegian singular/plural noun-count formatting.
//
// Every place a count sits next to a noun ("1 butikker" is wrong, "1
// butikk" is right) used to hand-roll its own `count === 1 ? "" : "er"`
// ternary. That works for simple suffix pluralization but silently breaks
// for anything with an irregular or two-word form ("ny drop" -> "nye
// drops" isn't a suffix change, it's a different adjective too) — several
// call sites just hardcoded the plural form unconditionally instead
// (showing "1 nye drops" at count 1). Centralizing here means every count+
// noun pairing goes through the same explicit singular/plural pair, no
// suffix-guessing required.

/** Picks the singular or plural form of a word based on count. count === 1 -> singular. */
export function pluralizeNb(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/** "1 prisendring" / "N prisendringer" */
export function priceChangesLabel(count: number): string {
  return pluralizeNb(count, "prisendring", "prisendringer");
}

/** "1 ny drop" / "N nye drops" */
export function dropsLabel(count: number): string {
  return pluralizeNb(count, "ny drop", "nye drops");
}

/** "1 drop" / "N drops" (no "ny/nye" prefix — for contexts where "new" is already implied, e.g. a week's own summary chip). */
export function bareDropsLabel(count: number): string {
  return pluralizeNb(count, "drop", "drops");
}

/** "1 butikk" / "N butikker" */
export function storesLabel(count: number): string {
  return pluralizeNb(count, "butikk", "butikker");
}

/** "1 kjent disk" / "N kjente disker" */
export function knownDiscsLabel(count: number): string {
  return pluralizeNb(count, "kjent disk", "kjente disker");
}

/** "1 disk" / "N disker" */
export function discsLabel(count: number): string {
  return pluralizeNb(count, "disk", "disker");
}

/**
 * "1 ny lagerføring" / "N nye lagerføringer" — includes a soft hyphen
 * (U+00AD) so the longer plural form still wraps sensibly on narrow mobile
 * layouts, without needing dangerouslySetInnerHTML for an HTML entity.
 */
export function stockingsLabel(count: number): string {
  return pluralizeNb(count, "ny lager­føring", "nye lager­føringer");
}

/** "1 lagerføring" / "N lagerføringer" (no "ny/nye" prefix — for compact badge contexts). */
export function bareStockingsLabel(count: number): string {
  return pluralizeNb(count, "lagerføring", "lagerføringer");
}
