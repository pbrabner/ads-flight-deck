import { test } from "node:test";
import assert from "node:assert/strict";
import { entityWrites, metricWrites, safeSyncError } from "./sync-data";
import { validSecret } from "./security";
import type { SyncResult } from "./connectors/types";
const data: SyncResult = {
  entities: [{ level: "campaign", externalId: "42", name: "Nome real", status: "ACTIVE", raw: {} }],
  metrics: [{ level: "campaign", externalId: "42", date: "2026-10-20", spend: 1, impressions: 5, clicks: 1, conversions: 1, conversionValue: 0, leads: 1, raw: {} },
    { level: "ad", externalId: "orphan", date: "2026-10-20", spend: 2, impressions: 6, clicks: 2, conversions: 0, conversionValue: 0, leads: 0, raw: {} }],
};
test("placeholder nunca sobrescreve entidade real e chaves incluem conta", () => {
  const writes = entityWrites(data, "ACCOUNT", "meta", "campaign", new Map());
  assert.equal(writes.actual[0].name, "Nome real");
  assert.equal(writes.actual[0].ad_account_id, "ACCOUNT");
  assert.equal(writes.placeholders.length, 0);
  assert.equal(entityWrites(data, "ACCOUNT", "meta", "ad", new Map()).placeholders[0].name, "orphan");
});
test("métrica sem entidade resolvida falha em vez de desaparecer", () => {
  assert.throws(() => metricWrites(data.metrics, new Map([["campaign:42", "uuid"]])), /unresolved_entity/);
});
test("erros de sync nunca devolvem texto arbitrário de upstream", () => {
  assert.equal(safeSyncError(new Error("token=SECRET")), "sync_failed");
  assert.equal(safeSyncError(new Error("token_invalid")), "token_invalid");
});
test("cron exige segredo configurado e comparação exata", () => {
  assert.equal(validSecret("", ""), false);
  assert.equal(validSecret("abcdef", "abcde"), false);
  assert.equal(validSecret("abcdef", "abcdef"), true);
});
