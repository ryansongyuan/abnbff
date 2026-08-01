import assert from "node:assert/strict";
import test from "node:test";
import { getPriceDirection } from "../lib/price-transition.mjs";

test("returns up only when the refreshed price increases", () => {
  assert.equal(getPriceDirection(150, 151), "up");
});

test("returns down only when the refreshed price decreases", () => {
  assert.equal(getPriceDirection(151, 150), "down");
});

test("does not animate unchanged or invalid prices", () => {
  assert.equal(getPriceDirection(150, 150), null);
  assert.equal(getPriceDirection(undefined, 150), null);
  assert.equal(getPriceDirection(150, Number.NaN), null);
});
