import test from "node:test";
import assert from "node:assert";
import { plasticKey, groupPlastics, defaultPlasticKey } from "./plastic.ts";

const e = (plastic: string | null, storeKey: string, price: number, inStock = true) =>
  ({ plastic, storeKey, price, inStock });

test("separator spellings of the same plastic share a key", () => {
  // Both pairs are live in the data: GStar/G-Star, Opto Ice/Opto-Ice.
  assert.strictEqual(plasticKey("G-Star"), plasticKey("GStar"));
  assert.strictEqual(plasticKey("Opto Ice"), plasticKey("Opto-Ice"));
});

test("word order does not make two plastics different", () => {
  assert.strictEqual(plasticKey("Proto Glow Halo Star"), plasticKey("Halo Star Proto Glow"));
  assert.strictEqual(plasticKey("Horizon C-Line"), plasticKey("C-Line Horizon"));
});

test("genuinely different plastics keep different keys", () => {
  assert.notStrictEqual(plasticKey("Star"), plasticKey("Halo Star"));
  assert.notStrictEqual(plasticKey("Champion"), plasticKey("Champion Glow"));
  assert.notStrictEqual(plasticKey("DX"), plasticKey("Pro"));
});

test("the label is the spelling most listings use, not a sorted one", () => {
  // The old normalizePlastic sorted words and showed the result, so shoppers
  // read "Glow Proto" and "Swirl Z" on the chips.
  const [g] = groupPlastics([
    e("Proto Glow", "a", 229), e("Proto Glow", "b", 232), e("proto glow", "c", 239),
  ]);
  assert.strictEqual(g.label, "Proto Glow");
});

test("the label follows the majority across merged spellings", () => {
  const [g] = groupPlastics([e("GStar", "a", 193), e("GStar", "b", 193), e("G-Star", "c", 189)]);
  assert.strictEqual(g.label, "GStar");
  assert.strictEqual(g.storeCount, 3);
});

test("coverage counts stores that actually have it in stock", () => {
  const [g] = groupPlastics([e("Star", "a", 199), e("Star", "b", 219, false), e("Star", "a", 205)]);
  assert.strictEqual(g.storeCount, 1);
});

test("the default is the widest-stocked plastic, not the cheapest", () => {
  // The Valkyrie case: DX is cheapest at 4 stores, Star is carried by 9.
  const groups = groupPlastics([
    ...["a", "b", "c", "d"].map((s) => e("DX", s, 125)),
    ...["a", "b", "c", "d", "e", "f", "g", "h", "i"].map((s) => e("Star", s, 199)),
  ]);
  const key = defaultPlasticKey(groups);
  assert.strictEqual(groups.find((g) => g.key === key)!.label, "Star");
});

test("a tie on coverage breaks toward the cheaper plastic", () => {
  const groups = groupPlastics([
    ...["a", "b"].map((s) => e("Champion", s, 209)),
    ...["a", "b"].map((s) => e("Star", s, 186)),
  ]);
  assert.strictEqual(groups.find((g) => g.key === defaultPlasticKey(groups))!.label, "Star");
});

test("a plastic nobody has in stock does not become the default", () => {
  const groups = groupPlastics([
    e("Halo Star", "a", 289, false), e("Halo Star", "b", 269, false),
    e("Champion", "c", 199),
  ]);
  assert.strictEqual(groups.find((g) => g.key === defaultPlasticKey(groups))!.label, "Champion");
});

test("entries with no plastic are skipped, not grouped under an empty label", () => {
  assert.deepStrictEqual(groupPlastics([e(null, "a", 205)]), []);
  assert.strictEqual(defaultPlasticKey([]), null);
});
