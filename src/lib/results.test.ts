import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeResults, summarizeResults, resultLabel, campaignStatus } from "./results";

test("resultado oficial usa a janela padrão sem somar atribuições", () => {
  assert.deepEqual(normalizeResults([{ indicator: "actions:lead", values: [{ value: "3", attribution_windows: ["default"] }, { value: "7", attribution_windows: ["7d_click"] }] }]), [{ type: "actions:lead", value: 3 }]);
  assert.deepEqual(normalizeResults([{ indicator: "actions:lead", values: [{ value: "0" }] }]), [{ type: "actions:lead", value: 0 }]);
});
test("ausência, alcance não aditivo e atribuição ambígua não viram zero", () => {
  assert.equal(normalizeResults(undefined), null);
  assert.equal(normalizeResults([]), null);
  assert.equal(normalizeResults([{ indicator: "reach", values: [{ value: "5" }] }]), null);
  assert.equal(normalizeResults([{ indicator: "actions:lead", values: [{ value: "3", attribution_windows: ["1d_click"] }, { value: "7", attribution_windows: ["7d_click"] }] }]), null);
});
test("normalização recusa duplicação e valor inválido", () => {
  const entry = { indicator: "actions:lead", values: [{ value: "3" }] };
  assert.equal(normalizeResults([entry, entry]), null);
  assert.equal(normalizeResults([{ ...entry, values: [{ value: "NaN" }] }]), null);
  assert.equal(normalizeResults([{ ...entry, values: [{ value: "-1" }] }]), null);
});
test("resumo mantém unidades distintas e custo ponderado só com cobertura completa", () => {
  const rows = [{ spend: 30, results: [{ type: "actions:lead", value: 2 }], result_complete: true }, { spend: 20, results: [{ type: "actions:lead", value: 3 }], result_complete: true }];
  assert.deepEqual(summarizeResults(rows), { groups: [{ type: "actions:lead", value: 5, spend: 50, cost: 10 }], complete: true, single: true });
  const mixed = summarizeResults([...rows, { spend: 8, results: [{ type: "actions:onsite_conversion.messaging_conversation_started_7d", value: 4 }], result_complete: true }]);
  assert.equal(mixed.single, false); assert.equal(mixed.groups.length, 2);
  const missing = summarizeResults([...rows, { spend: 7, results: null, result_complete: false }]);
  assert.equal(missing.complete, false); assert.equal(missing.single, false); assert.equal(missing.groups[0].cost, null);
});
test("rótulos distinguem conversas e leads e status inválido usa todas", () => {
  assert.equal(resultLabel("actions:onsite_conversion.messaging_conversation_started_7d"), "Conversas iniciadas");
  assert.equal(resultLabel("actions:lead"), "Leads");
  assert.equal(campaignStatus("active"), "active");
  assert.equal(campaignStatus("paused"), "paused");
  assert.equal(campaignStatus("inventado"), "all");
});

test("visitas ao perfil retornadas pela Meta são um resultado próprio", () => {
  assert.deepEqual(normalizeResults([{ indicator: "profile_visit_view", values: [{ value: "14" }] }]), [{ type: "profile_visit_view", value: 14 }]);
  assert.equal(resultLabel("profile_visit_view"), "Visitas ao perfil");
  assert.equal(normalizeResults([{ indicator: "actions:lead" }]), null);
});
