import { test } from "node:test";
import assert from "node:assert/strict";
import { totals, ratio, delta } from "./metrics";

test("taxas são ponderadas pelos totais", () => {
  const t = totals([
    { spend: 100, impressions: 1000, clicks: 10, leads: 2 },
    { spend: 50, impressions: 100, clicks: 20, leads: 1 },
  ]);
  assert.equal(t.spend, 150);
  assert.equal(t.cpc, 5);
  assert.equal(t.cpl, 50);
  assert.equal(t.ctr, 30 / 1100 * 100);
});
test("ausência de denominador não inventa custo zero", () => {
  assert.equal(ratio(4, 0), null);
  assert.equal(totals([]).cpl, null);
  assert.equal(delta(10, 0), null);
  assert.equal(delta(80, 100), -20);
});
