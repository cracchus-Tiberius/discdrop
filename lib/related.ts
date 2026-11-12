/**
 * "Lignende disker" — which other discs to link from a disc page.
 *
 * Two jobs at once. For a reader it answers the question the page provokes:
 * what else is like this, and what else does this brand make. For the site it
 * builds an internal link graph, which is what the catalogue has been missing
 * — 702 disc pages that linked to each other only through their brand page,
 * and 115 that nothing linked to at all.
 *
 * Deliberately not "popular" or "cheapest": those would point every page at
 * the same handful of discs and leave the tail as orphaned as before.
 * Nearest-by-flight spreads the links across the whole catalogue and happens
 * to be the honest answer to the reader's question too.
 */

type Flight = { speed: number; glide: number; turn: number; fade: number };
export type RelatableDisc = { id: string; name: string; brand: string; type: string; flight: Flight };

/**
 * How unlike two discs fly. Speed dominates because it decides who can throw
 * the disc at all — a speed-3 putter and a speed-12 driver are not neighbours
 * however well their turn and fade line up. Turn and fade outweigh glide
 * because they are what a thrower actually picks between.
 */
export function flightDistance(a: Flight, b: Flight): number {
  return (
    2 * Math.abs(a.speed - b.speed) +
    0.5 * Math.abs(a.glide - b.glide) +
    1.5 * Math.abs(a.turn - b.turn) +
    1.5 * Math.abs(a.fade - b.fade)
  );
}

/** Ties broken by name so the output is stable across builds. */
function byDistanceThenName<T extends RelatableDisc>(disc: T) {
  return (a: T, b: T) => {
    const d = flightDistance(disc.flight, a.flight) - flightDistance(disc.flight, b.flight);
    return d !== 0 ? d : a.name.localeCompare(b.name, "nb");
  };
}

export type RelatedDiscs<T> = {
  /** Same brand, nearest flight first. */
  sameBrand: T[];
  /** Same type, other brands, nearest flight first. */
  similar: T[];
};

/**
 * @param disc the page's disc
 * @param all the whole catalogue
 * @param limit how many to return per group
 */
export function relatedDiscs<T extends RelatableDisc>(
  disc: T,
  all: T[],
  limit = 4
): RelatedDiscs<T> {
  const others = all.filter((d) => d.id !== disc.id);

  const sameBrand = others
    .filter((d) => d.brand === disc.brand)
    .sort(byDistanceThenName(disc))
    .slice(0, limit);

  const similar = others
    .filter((d) => d.brand !== disc.brand && d.type === disc.type)
    .sort(byDistanceThenName(disc))
    .slice(0, limit);

  return { sameBrand, similar };
}
