/**
 * Brand slugs — one source of truth.
 *
 * There used to be two hand-maintained maps: SLUG_TO_BRAND in
 * app/brand/[slug]/page.tsx, which decided which brand pages get built, and
 * BRAND_SLUG in app/disc/[slug]/DiscDetailClient.tsx, which decided where a
 * disc page's brand link points. Both drifted from data/discs.js, in opposite
 * directions, and neither failed when it did:
 *
 *   - The brand pages still listed "EggShell Discs", renamed to "Dino Discs"
 *     in the catalogue on 2026-09-05. So /brand/eggshell-discs/ was built with
 *     zero discs on it and submitted to Google in sitemap.xml, while the five
 *     Dino Discs had no brand page at all.
 *   - Seven brands — Infinite, Legacy, Birdie, EV-7, Løft, Disc Golf UK and
 *     Northstar, 32 discs between them — were in neither map. The disc page
 *     fell back to slugifying the brand name, which produced links to
 *     /brand/infinite-discs/ and friends. None of those pages exist. Thirty-two
 *     disc pages were quietly linking to 404s.
 *
 * Deriving the slug from the brand name would have avoided all of that, except
 * that four of the existing slugs are deliberately NOT their brand's
 * slugified name — "MVP Disc Sports" is at /brand/mvp/, "RPM Discs" at
 * /brand/rpm/ — and those URLs are indexed. So the map stays explicit, and
 * lib/brands.test.ts asserts it against the catalogue instead: every brand has
 * a slug, every slug has discs. A rename now breaks a test rather than a page.
 */

// Relative, not the "@/" alias: lib/brands.test.ts runs under plain
// `node --test`, which does not resolve tsconfig path aliases.
import { discs } from "../data/discs.js";

/**
 * Brand name as it appears in data/discs.js -> URL slug.
 *
 * Several brands appear under more than one name in scraped titles and older
 * catalogue entries ("MVP" and "MVP Disc Sports"); the aliases below map to the
 * same slug on purpose, so only the canonical names need to match the
 * catalogue. Slugs are ASCII — "Løft Discs" is at /brand/loft-discs/.
 */
export const BRAND_TO_SLUG: Record<string, string> = {
  Alfa: "alfa",
  Axiom: "axiom",
  "Axiom Discs": "axiom",
  "Birdie Disc Golf Supply": "birdie-disc-golf-supply",
  "Clash Discs": "clash-discs",
  "Climo Disc Golf": "climo-disc-golf",
  DGA: "dga",
  "Dino Discs": "dino-discs",
  "Disc Golf UK": "disc-golf-uk",
  Discmania: "discmania",
  Discraft: "discraft",
  "Dynamic Discs": "dynamic-discs",
  "EV-7 Disc Golf": "ev-7-disc-golf",
  Gateway: "gateway",
  "Infinite Discs": "infinite-discs",
  Innova: "innova",
  Kastaplast: "kastaplast",
  "Latitude 64": "latitude-64",
  "Legacy Discs": "legacy-discs",
  "Lone Star Discs": "lone-star-discs",
  "Løft Discs": "loft-discs",
  MVP: "mvp",
  "MVP Disc Sports": "mvp",
  Millennium: "millennium",
  "Northstar Discs": "northstar-discs",
  Prodigy: "prodigy",
  Prodiscus: "prodiscus",
  "RPM Discs": "rpm",
  Streamline: "streamline",
  "Streamline Discs": "streamline",
  "Thought Space Athletics": "thought-space-athletics",
  "Viking Discs": "viking-discs",
  "Westside Discs": "westside-discs",
};

/**
 * Slug -> the canonical brand name, meaning the spelling the catalogue
 * actually uses. Built from the map above, so an alias never becomes the name
 * shown on a page: a slug resolves to whichever of its names appears in
 * data/discs.js.
 */
export const SLUG_TO_BRAND: Record<string, string> = (() => {
  const catalogBrands = new Set(discs.map((d) => d.brand));
  const out: Record<string, string> = {};
  for (const [brand, slug] of Object.entries(BRAND_TO_SLUG)) {
    // First writer wins unless a later name is the one the catalogue uses.
    if (!(slug in out) || catalogBrands.has(brand)) out[slug] = brand;
  }
  return out;
})();

/** Every slug that should have a brand page, in a stable order. */
export const BRAND_SLUGS: string[] = Object.keys(SLUG_TO_BRAND).sort();

/** Discs for one slug, including any brand-name aliases pointing at it. */
export function discsForSlug(slug: string) {
  const names = new Set(
    Object.entries(BRAND_TO_SLUG)
      .filter(([, s]) => s === slug)
      .map(([brand]) => brand)
  );
  return discs.filter((d) => names.has(d.brand));
}
