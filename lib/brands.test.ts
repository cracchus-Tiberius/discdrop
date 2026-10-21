import test from "node:test";
import assert from "node:assert/strict";

import { BRAND_TO_SLUG, SLUG_TO_BRAND, BRAND_SLUGS, discsForSlug } from "./brands.ts";
import { discs } from "../data/discs.js";

const catalogBrands = [...new Set(discs.map((d: { brand: string }) => d.brand))].sort();

test("every brand in the catalogue has a slug", () => {
  // The failure this guards against: "EggShell Discs" was renamed to "Dino
  // Discs" in discs.js on 2026-09-05 and nothing noticed, so those five discs
  // had no brand page while /brand/eggshell-discs/ was built empty and
  // submitted to Google.
  const missing = catalogBrands.filter((b) => !(b in BRAND_TO_SLUG));
  assert.deepEqual(
    missing,
    [],
    `No slug for: ${missing.join(", ")}. Add them to BRAND_TO_SLUG in lib/brands.ts — ` +
      `without one, every disc page of that brand links to a /brand/ URL that 404s.`
  );
});

test("every slug resolves to a brand that has discs", () => {
  // The other direction: a slug left behind by a rename builds a real page
  // with nothing on it.
  const empty = BRAND_SLUGS.filter((s) => discsForSlug(s).length === 0);
  assert.deepEqual(empty, [], `Slugs with no discs: ${empty.join(", ")}`);
});

test("every disc is reachable from exactly one brand page", () => {
  const seen = new Map<string, string[]>();
  for (const slug of BRAND_SLUGS) {
    for (const d of discsForSlug(slug)) {
      seen.set(d.id, [...(seen.get(d.id) ?? []), slug]);
    }
  }
  assert.equal(seen.size, discs.length, "some discs belong to no brand page");
  const multi = [...seen.entries()].filter(([, slugs]) => slugs.length > 1);
  assert.deepEqual(multi, [], "a disc is listed under more than one brand page");
});

test("a slug resolves to the spelling the catalogue uses, not an alias", () => {
  // "MVP" and "MVP Disc Sports" share a slug; the page must be titled with
  // whichever one discs.js actually uses, or the h1 disagrees with the data.
  for (const slug of BRAND_SLUGS) {
    const name = SLUG_TO_BRAND[slug];
    assert.ok(
      catalogBrands.includes(name),
      `/brand/${slug}/ would be titled "${name}", which is not a brand in discs.js`
    );
  }
});

test("slugs are URL-safe and unique", () => {
  for (const slug of BRAND_SLUGS) {
    assert.match(slug, /^[a-z0-9-]+$/, `slug "${slug}" is not plain ASCII`);
  }
  assert.equal(new Set(BRAND_SLUGS).size, BRAND_SLUGS.length);
});
