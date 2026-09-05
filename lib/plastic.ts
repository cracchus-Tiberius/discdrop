/**
 * Plastic grouping for the disc price comparison.
 *
 * Two jobs that used to be one, which is where the old normalizePlastic went
 * wrong: deciding whether two spellings are the SAME plastic, and deciding what
 * to CALL it on screen. It sorted the words and used the result for both, so
 * "Proto Glow" was displayed as "Glow Proto", "Z Swirl" as "Swirl Z" and
 * "K1 Soft Glow" as "Glow K1 Soft" — mangled names on every chip.
 */

/**
 * Grouping key. Lowercased, split on anything non-alphanumeric, sorted, joined
 * with no separator at all. Never shown to anyone.
 *
 * The separator-stripping is what collapses "G-Star" with "GStar" and
 * "Opto Ice" with "Opto-Ice"; the sort is what collapses "Proto Glow Halo Star"
 * with "Halo Star Proto Glow" and "Horizon C-Line" with "C-Line Horizon".
 * Verified against all 265 plastic strings in the live data: exactly those five
 * pairs merge and nothing else does.
 */
export function plasticKey(plastic: string): string {
  return plastic
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .sort()
    .join("");
}

export type PlasticGroup = {
  key: string;
  /** The spelling most stores actually use — what the chip and row labels show. */
  label: string;
  /** Stores with this plastic in stock. Drives the default selection. */
  storeCount: number;
  /** Cheapest in-stock price, used only to break a storeCount tie. */
  minPrice: number;
};

type Entry = { plastic: string | null; inStock: boolean; price: number; storeKey: string };

/**
 * Groups entries by plastic, in first-seen order, labelling each group with the
 * spelling the most listings use.
 */
export function groupPlastics(entries: Entry[]): PlasticGroup[] {
  const groups = new Map<string, { spellings: Map<string, number>; stores: Set<string>; minPrice: number }>();

  for (const e of entries) {
    if (!e.plastic) continue;
    const key = plasticKey(e.plastic);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) {
      g = { spellings: new Map(), stores: new Set(), minPrice: Infinity };
      groups.set(key, g);
    }
    const spelling = e.plastic.trim();
    g.spellings.set(spelling, (g.spellings.get(spelling) ?? 0) + 1);
    // Only in-stock listings count toward coverage and price. A plastic three
    // stores list but none of them have is not the one to open the page on.
    if (e.inStock) {
      g.stores.add(e.storeKey);
      if (e.price < g.minPrice) g.minPrice = e.price;
    }
  }

  return [...groups.entries()].map(([key, g]) => ({
    key,
    label: [...g.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "nb"))[0][0],
    storeCount: g.stores.size,
    minPrice: g.minPrice,
  }));
}

/**
 * Which plastic the page should open on: the one with the widest in-stock store
 * coverage, ties broken by price.
 *
 * Deliberately NOT the cheapest. Opening on the cheapest plastic is how the
 * page came to headline a DX Valkyrie at 125 kr against Star and Champion
 * listings elsewhere — it reproduces the very comparison this grouping exists
 * to stop. Widest coverage gives the most honest comparison the data supports.
 */
export function defaultPlasticKey(groups: PlasticGroup[]): string | null {
  const stocked = groups.filter((g) => g.storeCount > 0);
  const pool = stocked.length ? stocked : groups;
  if (!pool.length) return null;
  return [...pool].sort((a, b) => b.storeCount - a.storeCount || a.minPrice - b.minPrice)[0].key;
}
