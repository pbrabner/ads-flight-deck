import { test } from "node:test";
import assert from "node:assert/strict";
import { periodFromParams, todayIn, chunkRange } from "./period";

test("BRT mantém o dia anterior antes das 03h UTC", () => {
  assert.equal(todayIn(new Date("2026-10-20T01:00:00Z")), "2026-10-19");
});
test("sete dias inclusivos e comparação sem sobreposição", () => {
  assert.deepEqual(periodFromParams({ range: "7d" }, new Date("2026-10-20T12:00:00Z")),
    { range: "7d", from: "2026-10-14", to: "2026-10-20", prevFrom: "2026-10-07", prevTo: "2026-10-13" });
});
test("datas impossíveis e intervalos invertidos voltam ao padrão", () => {
  for (const [from, to] of [["2026-02-30", "2026-03-01"], ["2026-10-20", "2026-10-01"], ["bad", "bad"]]) {
    assert.equal(periodFromParams({ range: "custom", from, to }).range, "7d");
  }
});
test("mês atual compara trecho limitado ao mês anterior", () => {
  const p = periodFromParams({ range: "month" }, new Date("2026-03-31T12:00:00Z"));
  assert.equal(p.prevFrom, "2026-02-01");
  assert.equal(p.prevTo, "2026-02-28");
});
test("90 dias geram três janelas de 30 dias sem lacunas", () => {
  const chunks = chunkRange("2026-01-01", "2026-03-31", 30);
  assert.deepEqual(chunks, [
    { from: "2026-01-01", to: "2026-01-30" },
    { from: "2026-01-31", to: "2026-03-01" },
    { from: "2026-03-02", to: "2026-03-31" },
  ]);
  assert.throws(() => chunkRange("2026-01-01", "2026-01-02", 0));
});
