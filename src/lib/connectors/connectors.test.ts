import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMeta, insightsFields, metaNextUrl } from "./meta";
import { normalizeGoogle, googleHeaders, applyLeadActions, google } from "./google";
import { fetchJson } from "./http";

test("Meta normaliza métricas sem contar ações não configuradas como lead", () => {
  const row = normalizeMeta("campaign", { campaign_id: "42", date_start: "2026-10-20", spend: "32.50", impressions: "500", clicks: "10", actions: [{ action_type: "lead", value: "2" }, { action_type: "link_click", value: "10" }] }, ["lead"]);
  assert.equal(row.spend, 32.5); assert.equal(row.leads, 2); assert.equal(row.externalId, "42");
  assert.ok(!insightsFields("campaign").includes("ad_id"));
  assert.ok(insightsFields("ad").includes("ad_id"));
});
test("Meta importa resultado escolhido pelo provedor e objetivo sem depender do campo manual", () => {
  const row = normalizeMeta("campaign", { campaign_id: "42", date_start: "2026-10-20", objective: "OUTCOME_ENGAGEMENT", results: [{ indicator: "actions:onsite_conversion.messaging_conversation_started_7d", values: [{ value: "10", attribution_windows: ["default"] }] }] }, []);
  assert.deepEqual(row.results, [{ type: "actions:onsite_conversion.messaging_conversation_started_7d", value: 10 }]);
  assert.ok(insightsFields("campaign").split(",").includes("results"));
  assert.ok(insightsFields("campaign").split(",").includes("objective"));
});
test("Meta recusa paginação para outro host e remove token da URL", () => {
  assert.throws(() => metaNextUrl("https://evil.test/steal", "v25.0"));
  assert.equal(new URL(metaNextUrl("https://graph.facebook.com/v25.0/act_42/insights?after=x&access_token=SECRET", "v25.0")).searchParams.has("access_token"), false);
});
test("Google converte micros, mantém pais e usa chave composta para anúncio", () => {
  const data = normalizeGoogle("ad", [{ campaign: { id: "1" }, adGroup: { id: "2" }, adGroupAd: { ad: { id: "3", name: "Anúncio" }, status: "ENABLED" }, segments: { date: "2026-10-20" }, metrics: { costMicros: "1234567", clicks: "4", impressions: "90", conversions: "1.5" } }]);
  assert.equal(data.metrics[0].spend, 1.234567);
  assert.equal(data.entities[0].externalId, "2:3");
  assert.equal(data.entities[0].parentExternalId, "2");
  assert.equal(data.metrics[0].leads, 1.5);
});
test("Google só envia MCC quando token especifica o vínculo", () => {
  assert.equal(googleHeaders({ accessToken: "x" })["developer-token"], undefined);
  assert.equal(googleHeaders({ accessToken: "x" }, "ignored")["developer-token"], undefined);
  assert.equal(googleHeaders({ accessToken: "x" }, "dev")["login-customer-id"], undefined);
  assert.equal(googleHeaders({ accessToken: "x", loginCustomerId: "123-456" }, "dev")["login-customer-id"], "123456");
});
test("Google recalcula leads sem duplicar gasto de segmentos", () => {
  const data = normalizeGoogle("campaign", [{ campaign: { id: "1", name: "Campanha" }, segments: { date: "2026-10-20" }, metrics: { costMicros: "2000000", conversions: "9" } }]);
  applyLeadActions(data.metrics, "campaign", [{ campaign: { id: "1" }, segments: { date: "2026-10-20", conversionActionName: "Venda" }, metrics: { conversions: "3" } }], ["Venda"]);
  assert.equal(data.metrics[0].leads, 3); assert.equal(data.metrics[0].spend, 2);
});
test("HTTP não expõe corpo de erro ou credenciais", async () => {
  await assert.rejects(() => fetchJson("https://example.test?secret=VALUE", {}, async () => new Response("SECRET_VALUE", { status: 500 })), /upstream_500/);
  await assert.rejects(() => fetchJson("https://example.test", {}, async () => new Response(JSON.stringify({ error: { code: 190, message: "SECRET" } }), { status: 400 })), /^Error: token_invalid$/);
});
test("sync Google preserva pais de anúncios removidos presentes no histórico", async (t) => {
  const keys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"];
  const original = keys.map(key => process.env[key]);
  keys.forEach(key => { process.env[key] = "test"; });
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  t.after(() => keys.forEach((key, i) => { if (original[i] === undefined) delete process.env[key]; else process.env[key] = original[i]; }));
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (String(url).includes("oauth2")) return Response.json({ access_token: "access" });
    const query = JSON.parse(String(init.body)).query as string;
    if (query.includes("FROM customer")) return Response.json([{ results: [{ customer: { currencyCode: "BRL", timeZone: "America/Sao_Paulo" } }] }]);
    if (query.includes("!= 'REMOVED'")) return Response.json([{}]);
    return Response.json([{ results: [{
      campaign: { id: "1", name: "Campanha histórica", status: "REMOVED" },
      adGroup: { id: "2", name: "Conjunto histórico", status: "REMOVED" },
      adGroupAd: { ad: { id: "3", name: "Anúncio histórico" }, status: "REMOVED" },
      segments: { date: "2026-10-20" }, metrics: { costMicros: "1000000", clicks: "2", conversions: "1" },
    }] }]);
  });
  const result = await google.sync({ externalId: "123", leadActions: [] }, { accessToken: "", refreshToken: "refresh" }, "2026-10-20", "2026-10-20");
  assert.equal(result.entities.length, 3);
  assert.equal(result.entities.find(e => e.level === "ad")?.parentExternalId, "2");
  assert.equal(result.entities.find(e => e.level === "adset")?.parentExternalId, "1");
});
