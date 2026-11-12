import test from "node:test";
import assert from "node:assert/strict";

import { relatedDiscs, flightDistance, type RelatableDisc } from "./related.ts";
import { discs } from "../data/discs.js";

const d = (
  id: string,
  brand: string,
  type: string,
  [speed, glide, turn, fade]: number[],
  name = id
): RelatableDisc => ({ id, name, brand, type, flight: { speed, glide, turn, fade } });

test("speed outweighs the other numbers", () => {
  const putter = { speed: 3, glide: 3, turn: 0, fade: 1 };
  const sameSpeed = { speed: 3, glide: 5, turn: -2, fade: 3 };
  const sameShape = { speed: 12, glide: 3, turn: 0, fade: 1 };
  assert.ok(
    flightDistance(putter, sameSpeed) < flightDistance(putter, sameShape),
    "a disc of the same speed should be nearer than one with the same turn/fade nine speeds away"
  );
});

test("the disc itself is never related to itself", () => {
  const subject = d("a", "Innova", "putter", [3, 3, 0, 1]);
  const { sameBrand, similar } = relatedDiscs(subject, [subject, d("b", "Innova", "putter", [3, 3, 0, 1])]);
  assert.deepEqual([...sameBrand, ...similar].map((x) => x.id), ["b"]);
});

test("sameBrand keeps the brand, similar excludes it and keeps the type", () => {
  const subject = d("subject", "Innova", "putter", [3, 3, 0, 1]);
  const all = [
    subject,
    d("innova-near", "Innova", "putter", [3, 3, 0, 1]),
    d("innova-driver", "Innova", "distance", [12, 5, -1, 3]),
    d("discraft-putter", "Discraft", "putter", [3, 3, 0, 2]),
    d("discraft-driver", "Discraft", "distance", [12, 5, -1, 3]),
  ];
  const { sameBrand, similar } = relatedDiscs(subject, all);
  assert.deepEqual(sameBrand.map((x) => x.id), ["innova-near", "innova-driver"]);
  assert.deepEqual(similar.map((x) => x.id), ["discraft-putter"]);
});

test("nearest flight comes first, and ties are stable", () => {
  const subject = d("subject", "Innova", "putter", [3, 3, 0, 1]);
  const all = [
    subject,
    d("far", "Innova", "putter", [7, 3, 0, 1]),
    d("near", "Innova", "putter", [3, 3, 0, 2]),
    d("tie-b", "Innova", "putter", [4, 3, 0, 1], "Beta"),
    d("tie-a", "Innova", "putter", [2, 3, 0, 1], "Alfa"),
  ];
  const { sameBrand } = relatedDiscs(subject, all);
  assert.deepEqual(sameBrand.map((x) => x.id), ["near", "tie-a", "tie-b", "far"]);
});

test("limit is respected per group", () => {
  const subject = d("subject", "Innova", "putter", [3, 3, 0, 1]);
  const all = [subject, ...Array.from({ length: 9 }, (_, i) => d(`x${i}`, "Innova", "putter", [3, 3, 0, i]))];
  assert.equal(relatedDiscs(subject, all, 4).sameBrand.length, 4);
  assert.equal(relatedDiscs(subject, all, 2).sameBrand.length, 2);
});

test("every disc in the real catalogue gets at least one link out", () => {
  // The whole point: no disc page may be a dead end, or it contributes
  // nothing to the link graph it was added to fix.
  const all = discs as RelatableDisc[];
  const barren = all.filter((disc) => {
    const { sameBrand, similar } = relatedDiscs(disc, all);
    return sameBrand.length + similar.length === 0;
  });
  assert.deepEqual(barren.map((x) => x.id), []);
});

test("the real catalogue ends up linking to nearly every disc", () => {
  // A "related" rule that points every page at the same few discs would leave
  // the tail as orphaned as it was. Measured, not assumed.
  const all = discs as RelatableDisc[];
  const linked = new Set<string>();
  for (const disc of all) {
    const { sameBrand, similar } = relatedDiscs(disc, all);
    for (const r of [...sameBrand, ...similar]) linked.add(r.id);
  }
  assert.ok(
    linked.size > all.length * 0.8,
    `related links only reach ${linked.size} of ${all.length} discs — too concentrated to help the link graph`
  );
});
