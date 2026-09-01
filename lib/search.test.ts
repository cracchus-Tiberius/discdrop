import test from "node:test";
import assert from "node:assert/strict";
import { searchDiscs, normalizeSearchText, type SearchableDisc } from "./search.ts";

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
