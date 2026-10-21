import { test } from "node:test";
import assert from "node:assert/strict";
import { accountFreshness, type SyncRecord } from "./data-freshness";

const now = new Date("2026-10-21T15:00:00Z");
const account = { id: "a", external_id: "123", active: true };
const success: SyncRecord = { status: "ok", started_at: "2026-10-21T07:00:00Z", finished_at: "2026-10-21T07:02:00Z", from_date: "2026-10-15", to_date: "2026-10-21" };
test("coleta recente conserva horário e janela, sem inventar cobertura", () => {
  const result = accountFreshness(account, success, success, now);
  assert.equal(result.state, "recent");
  assert.equal(result.collectedAt, success.finished_at);
  assert.equal(result.from, success.from_date);
});
test("falha posterior preserva data anterior e exige reconexão apenas por código conhecido", () => {
  const result = accountFreshness(account, { ...success, status: "error", error: "token_invalid" }, success, now);
  assert.equal(result.state, "error");
  assert.equal(result.collectedAt, success.finished_at);
  assert.equal(result.needsReconnection, true);
  assert.equal(accountFreshness(account, { ...success, error: "secret or arbitrary upstream text" }, success, now).needsReconnection, false);
});
test("coleta antiga e importação recente de período antigo não indicam atualidade", () => {
  assert.equal(accountFreshness(account, success, { ...success, finished_at: "2026-10-19T07:02:00Z" }, now).state, "stale");
  assert.equal(accountFreshness(account, success, { ...success, to_date: "2026-09-30" }, now).state, "stale");
});
test("execução abandonada não aparece em andamento para sempre", () => {
  assert.equal(accountFreshness(account, { ...success, status: "running", started_at: "2026-10-21T14:59:00Z" }, success, now).state, "running");
  assert.equal(accountFreshness(account, { ...success, status: "running" }, success, now).state, "interrupted");
});
test("conta sem coleta e sincronização desativada são estados distintos", () => {
  assert.equal(accountFreshness(account, null, null, now).state, "waiting");
  assert.equal(accountFreshness({ ...account, active: false }, success, success, now).state, "disabled");
});
test("data inválida ou futura nunca é apresentada como coleta recente", () => {
  assert.equal(accountFreshness(account, success, { ...success, finished_at: "invalid" }, now).state, "waiting");
  assert.equal(accountFreshness(account, success, { ...success, finished_at: "2026-10-22T07:00:00Z" }, now).state, "stale");
});
