import { test } from "node:test";
import assert from "node:assert/strict";
import { demoSnapshot } from "./demo";
import { periodFromParams } from "./period";
import { totals } from "./metrics";
test("demonstração soma apenas campanhas e preserva totais ao detalhar", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const period = periodFromParams({ range: "7d" }, now);
  const root = demoSnapshot(period, "campaign", null, now);
  const sums = totals(root.entities);
  assert.ok(sums.spend > 0);
  assert.ok(Math.abs(sums.spend - totals(root.series).spend) < 0.01);
  const campaign = root.entities[0];
  const child = demoSnapshot(period, "adset", campaign.id, now);
  assert.ok(Math.abs(totals(child.entities).spend - campaign.spend) < 0.01);
});
test("demonstração não inventa histórico fora da janela disponível", () => {
  const period = periodFromParams({ range: "custom", from: "2020-01-01", to: "2020-01-10" });
  assert.equal(demoSnapshot(period).series.length, 0);
});

test("filtro de status seleciona as mesmas campanhas nos dois períodos e nas séries", () => {
  const now = new Date("2026-10-20T12:00:00Z"), period = periodFromParams({ range: "7d" }, now);
  const all = demoSnapshot(period, "campaign", null, now), active = demoSnapshot(period, "campaign", null, now, "active"), paused = demoSnapshot(period, "campaign", null, now, "paused");
  assert.equal(active.entities.length, 4); assert.equal(paused.entities.length, 2);
  assert.ok(Math.abs(totals(active.entities).spend - totals(active.series).spend) < .01);
  assert.ok(Math.abs(totals(all.previous).spend - totals(active.previous).spend - totals(paused.previous).spend) < .01);
  assert.ok(active.entities.every(e => e.status === "ACTIVE"));
});

test("plataforma separa campanhas, séries e comparação anterior, combinada com status", () => {
  const now = new Date("2026-10-20T12:00:00Z"), period = periodFromParams({ range: "7d" }, now);
  for (const status of ["all", "active", "paused"] as const) {
    const all = demoSnapshot(period, "campaign", null, now, status);
    const meta = demoSnapshot(period, "campaign", null, now, status, "meta");
    const google = demoSnapshot(period, "campaign", null, now, status, "google");
    assert.ok(meta.entities.every(e => e.platform === "meta"));
    assert.ok(google.entities.every(e => e.platform === "google"));
    assert.equal(meta.entities.length + google.entities.length, all.entities.length);
    for (const key of ["series", "previous"] as const) {
      assert.ok(Math.abs(totals(all[key]).spend - totals(meta[key]).spend - totals(google[key]).spend) < .01);
      assert.ok(google[key].every(row => row.results?.every(r => r.type === "google:conversions")));
    }
    assert.ok(Math.abs(totals(meta.entities).spend - totals(meta.series).spend) < .01);
    assert.ok(Math.abs(totals(google.entities).spend - totals(google.series).spend) < .01);
  }
});
