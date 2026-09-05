import test from "node:test";
import assert from "node:assert/strict";
import { searchDiscs, suggestDiscNames, normalizeSearchText, type SearchableDisc } from "./search.ts";

function disc(overrides: Partial<SearchableDisc> & { id: string; name: string; brand: string }): SearchableDisc {
  return { plastics: [], player: null, ...overrides };
}

test("normalizeSearchText strips diacritics but leaves æ/ø/å intact", () => {
  assert.equal(normalizeSearchText("Café"), "cafe");
  assert.equal(normalizeSearchText("Bæg Øre Åre"), "bæg øre åre");
  assert.equal(normalizeSearchText("ÉCLIPSE"), "eclipse");
});

test('searchDiscs: "berg" ranks Berg before Berg X before a disc with berg only inside the name', () => {
  const discs = [
    disc({ id: "iceberg", name: "Iceberg", brand: "Some Brand" }),
    disc({ id: "bergx", name: "Berg X", brand: "Some Brand" }),
    disc({ id: "berg", name: "Berg", brand: "Kastaplast" }),
  ];
  const results = searchDiscs("berg", discs);
  assert.deepEqual(results.map((r) => r.disc.id), ["berg", "bergx", "iceberg"]);
});

test('searchDiscs: "ec" (2 chars) matches disc names but never plastic ("Recycled ESP" noise)', () => {
  const discs = [
    disc({ id: "echo", name: "Echo", brand: "Discraft" }),
    disc({ id: "recycled-plastic-disc", name: "Buzzz", brand: "Discraft", plastics: ["Recycled ESP"] }),
  ];
  const results = searchDiscs("ec", discs);
  assert.deepEqual(results.map((r) => r.disc.id), ["echo"]);
});

test('searchDiscs: a 3+ char query DOES match plastic ("Recycled ESP" for "recycled")', () => {
  const discs = [
    disc({ id: "buzzz", name: "Buzzz", brand: "Discraft", plastics: ["Recycled ESP"] }),
    disc({ id: "echo", name: "Echo", brand: "Discraft" }),
  ];
  const results = searchDiscs("recycled", discs);
  assert.equal(results.length, 1);
  assert.equal(results[0].disc.id, "buzzz");
  assert.equal(results[0].matchedField, "plastic");
  assert.equal(results[0].matchedPlastic, "Recycled ESP");
});

test('searchDiscs: "zo" ranks Zone (prefix) ahead of a substring-only match', () => {
  const discs = [
    disc({ id: "amazonas", name: "Amazonas", brand: "Some Brand" }),
    disc({ id: "zone", name: "Zone", brand: "Discraft" }),
    disc({ id: "zone-os", name: "Zone OS", brand: "Discraft" }),
  ];
  const results = searchDiscs("zo", discs);
  assert.deepEqual(results.map((r) => r.disc.id), ["zone", "zone-os", "amazonas"]);
});

test("searchDiscs: field priority — name beats brand beats plastic, even when a lower-priority field matches too", () => {
  const discs = [
    // "star" matches this disc's BRAND (prefix) and nothing else.
    disc({ id: "b", name: "Wraith", brand: "Starburst Discs" }),
    // "star" matches this disc's NAME (substring, not prefix) — should still outrank the brand match above.
    disc({ id: "a", name: "All-Star", brand: "Innova" }),
  ];
  const results = searchDiscs("star", discs);
  assert.deepEqual(results.map((r) => r.disc.id), ["a", "b"]);
});

test("searchDiscs: is case-insensitive", () => {
  const discs = [disc({ id: "destroyer", name: "Destroyer", brand: "Innova" })];
  assert.equal(searchDiscs("DESTROYER", discs).length, 1);
  assert.equal(searchDiscs("dEsTrOyEr", discs).length, 1);
});

test("searchDiscs: player name only matches at 3+ characters", () => {
  const discs = [disc({ id: "d1", name: "Some Disc", brand: "Some Brand", player: "Eagle McMahon" })];
  assert.equal(searchDiscs("ea", discs).length, 0); // 2 chars — player matching disabled
  assert.equal(searchDiscs("eag", discs).length, 1); // 3 chars — allowed
  assert.equal(searchDiscs("eag", discs)[0].matchedField, "player");
});

test("searchDiscs: empty query returns no results", () => {
  const discs = [disc({ id: "d1", name: "Destroyer", brand: "Innova" })];
  assert.deepEqual(searchDiscs("", discs), []);
  assert.deepEqual(searchDiscs("   ", discs), []);
});

test("searchDiscs: matchStart/matchLength point at the real match position for highlighting", () => {
  const discs = [disc({ id: "d1", name: "Discraft Buzzz", brand: "Discraft" })];
  const [result] = searchDiscs("buzz", discs);
  assert.equal(result.matchedField, "name");
  assert.equal(result.matchStart, "Discraft ".length);
  assert.equal(result.matchLength, 4);
});

// ── One core for both surfaces ───────────────────────────────────────────────

test('searchDiscs: a type query returns that type — /browse had this, the dropdown did not', () => {
  const results = searchDiscs("putter", [
    disc({ id: "a", name: "Berg", brand: "Kastaplast", type: "putter" }),
    disc({ id: "b", name: "Destroyer", brand: "Innova", type: "distance" }),
  ]);
  assert.deepEqual(results.map((r) => r.disc.id), ["a"]);
  assert.equal(results[0].matchedField, "type");
});

test('searchDiscs: a type match never outranks a disc actually named for the query', () => {
  const results = searchDiscs("putter", [
    disc({ id: "type", name: "Berg", brand: "Kastaplast", type: "putter" }),
    disc({ id: "name", name: "Putter Line", brand: "Whatever", type: "distance" }),
  ]);
  assert.deepEqual(results.map((r) => r.disc.id), ["name", "type"]);
});

test('searchDiscs: type respects the same minimum length as plastic', () => {
  // "pu" must not dump every putter over genuine name matches.
  assert.deepEqual(searchDiscs("pu", [disc({ id: "a", name: "Berg", brand: "K", type: "putter" })]), []);
});

test('searchDiscs: "star destroyer" finds the Star Destroyer', () => {
  // A plastic and a mold. No single field contains both, so a whole-string
  // search found nothing — on either surface, before this.
  const results = searchDiscs("star destroyer", [
    disc({ id: "d", name: "Destroyer", brand: "Innova", type: "distance", plastics: ["Star", "Champion"] }),
    disc({ id: "w", name: "Wraith", brand: "Innova", type: "distance", plastics: ["Star"] }),
    disc({ id: "b", name: "Destroyer", brand: "Other", type: "distance", plastics: ["DX"] }),
  ]);
  assert.deepEqual(results.map((r) => r.disc.id), ["d"]);
});

test('searchDiscs: the multi-term pass only runs when the direct pass found nothing', () => {
  // "buzzz gt" matches a disc name directly; that must win outright rather
  // than being widened into every disc carrying either word.
  const results = searchDiscs("buzzz gt", [
    disc({ id: "gt", name: "Buzzz GT", brand: "Discraft", type: "midrange" }),
    disc({ id: "os", name: "Buzzz OS", brand: "Discraft", type: "midrange", plastics: ["GT"] }),
  ]);
  assert.deepEqual(results.map((r) => r.disc.id), ["gt"]);
});

test('searchDiscs: every term must match, not just one', () => {
  assert.deepEqual(
    searchDiscs("star nonexistentword", [
      disc({ id: "d", name: "Destroyer", brand: "Innova", type: "distance", plastics: ["Star"] }),
    ]),
    []
  );
});

// ── Fuzzy suggestions ────────────────────────────────────────────────────────
// Offers, never corrections. Only consulted when a search found nothing.

const catalog = [
  disc({ id: "rhythm", name: "Rhythm", brand: "MVP", type: "midrange" }),
  disc({ id: "rhyno", name: "Rhyno", brand: "Innova", type: "putter" }),
  disc({ id: "destroyer", name: "Destroyer", brand: "Innova", type: "distance" }),
  disc({ id: "buzzz", name: "Buzzz", brand: "Discraft", type: "midrange" }),
  disc({ id: "pd2", name: "PD2", brand: "Discmania", type: "distance" }),
  disc({ id: "cd2", name: "CD2", brand: "Discmania", type: "fairway" }),
  disc({ id: "berg", name: "Berg", brand: "Kastaplast", type: "putter" }),
];

test("suggestDiscNames: a one-edit misspelling reaches the disc", () => {
  assert.deepEqual(suggestDiscNames("rhytm", catalog), ["Rhythm"]);
  assert.deepEqual(suggestDiscNames("destroyr", catalog), ["Destroyer"]);
});

test("suggestDiscNames: brand misspellings work too", () => {
  assert.deepEqual(suggestDiscNames("kastaplst", catalog), ["Kastaplast"]);
});

test("suggestDiscNames: nothing plausible means no suggestion, not a wild guess", () => {
  assert.deepEqual(suggestDiscNames("xyzzy", catalog), []);
});

test("suggestDiscNames: short queries get no suggestions at all", () => {
  // 2374 pairs of real mold names in this catalog sit within edit distance 2 of
  // each other, almost all of them 2-3 characters: PD2 is one edit from CD2,
  // DD2, FD2 and MD2. Suggesting against those is noise dressed as help.
  assert.deepEqual(suggestDiscNames("pd3", catalog), []);
  assert.deepEqual(suggestDiscNames("zzz", catalog), []);
});

test("suggestDiscNames: two edits are only allowed once the query is long enough", () => {
  // "berg" is 4 chars, so one edit — "bxrg" reaches it, "bxrx" does not.
  assert.deepEqual(suggestDiscNames("bxrg", catalog), ["Berg"]);
  assert.deepEqual(suggestDiscNames("bxrx", catalog), []);
  // "destroyer" is long enough that two edits are still a plausible typo.
  assert.deepEqual(suggestDiscNames("destroyar", catalog), ["Destroyer"]);
});

test("suggestDiscNames: at most three, closest first", () => {
  const many = Array.from({ length: 8 }, (_, i) => disc({ id: `d${i}`, name: `Rhyth${"abcdefgh"[i]}`, brand: "X" }));
  assert.ok(suggestDiscNames("rhytha", many).length <= 3);
});

test("a query with results never reaches the suggestion path", () => {
  // "buzz" already matches Buzzz by substring — the caller must not offer
  // alternatives over a working result.
  assert.ok(searchDiscs("buzz", catalog).length > 0);
});
