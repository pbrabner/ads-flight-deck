import test from "node:test";
import assert from "node:assert/strict";
import { readCampaign, validateCampaignChange, applyCampaignChange, type CampaignSnapshot, type CampaignTarget } from "./campaign-provider";

const credentials = { accessToken: "private-token" };
const google: CampaignTarget = { platform: "google", accountId: "1234567890", campaignId: "42", loginCustomerId: "9876543210" };
const meta: CampaignTarget = { platform: "meta", accountId: "123", campaignId: "42" };
const snapshot: CampaignSnapshot = { name: "Campaign", status: "ACTIVE", dailyBudgetMinor: "1234", budgetRef: "customers/1234567890/campaignBudgets/8", budgetEditable: true, budgetReason: null, canEdit: true };
const googleRow = () => ({ customer: { id: "1234567890", currencyCode: "BRL", timeZone: "America/Sao_Paulo" }, campaign: { id: "42", resourceName: "customers/1234567890/campaigns/42", name: "Campaign", status: "ENABLED", campaignBudget: "customers/1234567890/campaignBudgets/8" }, campaignBudget: { resourceName: "customers/1234567890/campaignBudgets/8", amountMicros: "12340000", explicitlyShared: false, referenceCount: "1", period: "DAILY" } });
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status }); }
function googleRead(row = googleRow()): typeof fetch { return async (url, init) => { assert.match(String(url), /customers\/1234567890\/googleAds:searchStream$/); assert.match(JSON.parse(String(init?.body)).query, /WHERE campaign.id = 42/); return json([{ results: [row] }]); }; }
function metaRead(options: { daily?: string; lifetime?: string; accountId?: string; permission?: boolean } = {}): typeof fetch {
  return async (url) => {
    if (String(url).includes("/me/permissions")) return json({ data: [{ permission: "ads_management", status: options.permission === false ? "declined" : "granted" }] });
    if (String(url).includes("/act_123")) return json({ id: "act_123", account_id: "123", currency: "BRL", timezone_name: "America/Sao_Paulo" });
    return json({ id: "42", account_id: options.accountId ?? "123", name: "Campaign", status: "ACTIVE", daily_budget: options.daily ?? "1234", lifetime_budget: options.lifetime ?? "0" });
  };
}

test("Google reads exact minor currency units and scopes campaign identity", async () => {
  assert.deepEqual(await readCampaign(google, credentials, googleRead()), snapshot);
  const row = googleRow(); row.campaign.id = "43";
  await assert.rejects(readCampaign(google, credentials, googleRead(row)), /target_mismatch/);
});
test("Google blocks shared and non-daily budgets while preserving status edits", async () => {
  for (const change of [{ explicitlyShared: true }, { referenceCount: "2" }, { period: "CUSTOM_PERIOD" }]) {
    const row = googleRow(); Object.assign(row.campaignBudget, change);
    const current = await readCampaign(google, credentials, googleRead(row));
    assert.equal(current.budgetEditable, false); assert.equal(current.canEdit, true);
    await assert.rejects(validateCampaignChange(google, credentials, { kind: "daily_budget", value: "1" }, current, googleRead(row)), /budget_not_editable/);
  }
});
test("Google never rounds sub-cent micros or unsafe JSON numbers", async () => {
  const row = googleRow(); row.campaignBudget.amountMicros = "12340001";
  const current = await readCampaign(google, credentials, googleRead(row));
  assert.equal(current.dailyBudgetMinor, null); assert.equal(current.budgetEditable, false);
  Object.assign(row.campaignBudget, { amountMicros: 9007199254740992 });
  assert.equal((await readCampaign(google, credentials, googleRead(row))).budgetEditable, false);
});
test("Meta blocks lifetime or adset budgets and requires management permission", async () => {
  assert.equal((await readCampaign(meta, credentials, metaRead())).dailyBudgetMinor, "1234");
  for (const opts of [{ lifetime: "50000" }, { daily: "0" }]) {
    const current = await readCampaign(meta, credentials, metaRead(opts));
    assert.equal(current.budgetEditable, false); assert.equal(current.canEdit, true);
  }
  assert.equal((await readCampaign(meta, credentials, metaRead({ permission: false }))).canEdit, false);
  await assert.rejects(readCampaign(meta, credentials, metaRead({ accountId: "999" })), /target_mismatch/);
});
test("invalid identifiers are rejected before any network call", async () => {
  const never: typeof fetch = async () => { assert.fail("network must not run"); };
  await assert.rejects(readCampaign({ ...google, campaignId: "42 OR 1=1" }, credentials, never), /invalid_target/);
  await assert.rejects(readCampaign({ ...meta, accountId: "../me" }, credentials, never), /invalid_target/);
});
test("Google previews validateOnly and converts cents to micros without precision loss", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetcher: typeof fetch = async (url, init) => { calls.push({ url: String(url), init: init! }); return json({}); };
  await validateCampaignChange(google, credentials, { kind: "daily_budget", value: "900719925474" }, snapshot, fetcher);
  assert.match(calls[0].url, /campaignBudgets:mutate$/);
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { operations: [{ update: { resourceName: snapshot.budgetRef, amountMicros: "9007199254740000" }, updateMask: "amountMicros" }], validateOnly: true });
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("authorization"), "Bearer private-token"); assert.equal(headers.get("login-customer-id"), "9876543210"); assert.equal(headers.has("developer-token"), false);
});
test("Google applies status through one specific mutation and verifies returned identity", async () => {
  let count = 0;
  await applyCampaignChange(google, credentials, { kind: "status", value: "ACTIVE" }, snapshot, async (url, init) => {
    count++; assert.match(String(url), /campaigns:mutate$/);
    assert.deepEqual(JSON.parse(String(init?.body)), { operations: [{ update: { resourceName: "customers/1234567890/campaigns/42", status: "ENABLED" }, updateMask: "status" }], validateOnly: false });
    return json({ results: [{ resourceName: "customers/1234567890/campaigns/42" }] });
  });
  assert.equal(count, 1);
});
test("Meta validation only checks permissions and apply uses a form POST", async () => {
  const current = { ...snapshot, budgetRef: "42" };
  await validateCampaignChange(meta, credentials, { kind: "daily_budget", value: "1500" }, current, async (url, init) => {
    assert.match(String(url), /me\/permissions/); assert.notEqual(init?.method, "POST");
    return json({ data: [{ permission: "ads_management", status: "granted" }] });
  });
  await applyCampaignChange(meta, credentials, { kind: "daily_budget", value: "1500" }, current, async (url, init) => {
    assert.match(String(url), /\/42$/); assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer private-token");
    assert.equal(String(init?.body), "daily_budget=1500"); return json({ success: true });
  });
});
test("invalid budgets, permissions and cross-account budget refs never mutate", async () => {
  const never: typeof fetch = async () => { assert.fail("network must not run"); };
  for (const value of ["0", "-1", "1.2", "01", "1e3", "922337203685478"]) await assert.rejects(applyCampaignChange(google, credentials, { kind: "daily_budget", value }, snapshot, never), /invalid_change/);
  await assert.rejects(applyCampaignChange(google, credentials, { kind: "status", value: "PAUSED" }, { ...snapshot, canEdit: false }, never), /permission_required/);
  await assert.rejects(applyCampaignChange(google, credentials, { kind: "daily_budget", value: "1" }, { ...snapshot, budgetRef: "customers/999/campaignBudgets/8" }, never), /target_mismatch/);
});
test("writes sanitize rejection and ambiguous failures without retries", async () => {
  for (const scenario of ["network", "timeout", "server", "bad_json", "bad_success", "rejected"] as const) {
    let calls = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      calls++; assert.ok(init?.signal); assert.equal(init?.redirect, "error");
      if (scenario === "timeout") throw new DOMException("private-token", "TimeoutError");
      if (scenario === "network") throw new Error("private-token secret raw payload");
      if (scenario === "bad_json") return new Response("private-token", { status: 200 });
      if (scenario === "bad_success") return json({ success: false });
      return json({ error: { message: "private-token" } }, scenario === "server" ? 503 : 403);
    };
    await assert.rejects(applyCampaignChange(meta, credentials, { kind: "status", value: "PAUSED" }, { ...snapshot, budgetRef: "42" }, fetcher), (error: Error) => { assert.equal(error.message, scenario === "rejected" ? "provider_rejected" : "outcome_unknown"); return true; });
    assert.equal(calls, 1);
  }
});
test("provider identity and account metadata cannot be substituted", async () => {
  const otherAccount = googleRow(); otherAccount.customer.id = "555";
  await assert.rejects(readCampaign(google, credentials, googleRead(otherAccount)), /target_mismatch/);
  const otherBudget = googleRow(); otherBudget.campaignBudget.resourceName = "customers/999/campaignBudgets/8";
  await assert.rejects(readCampaign(google, credentials, googleRead(otherBudget)), /target_mismatch/);
  const currency = googleRow(); currency.customer.currencyCode = "USD";
  await assert.rejects(readCampaign(google, credentials, googleRead(currency)), /unsupported_currency_or_timezone/);
  const timezone = googleRow(); timezone.customer.timeZone = "America/New_York";
  await assert.rejects(readCampaign(google, credentials, googleRead(timezone)), /unsupported_currency_or_timezone/);
});
test("permission revocation prevents Meta proposal validation", async () => {
  await assert.rejects(validateCampaignChange(meta, credentials, { kind: "status", value: "PAUSED" }, snapshot, metaRead({ permission: false })), /permission_required/);
});
test("a Google success response for the wrong resource is uncertain", async () => {
  for (const data of [{}, { results: [{ resourceName: "customers/1234567890/campaigns/99" }] }]) {
    let calls = 0;
    await assert.rejects(applyCampaignChange(google, credentials, { kind: "status", value: "PAUSED" }, snapshot, async () => { calls++; return json(data); }), /outcome_unknown/);
    assert.equal(calls, 1);
  }
});
test("Google budget apply uses exact micros and validates the budget result", async () => {
  await applyCampaignChange(google, credentials, { kind: "daily_budget", value: "1999" }, snapshot, async (url, init) => {
    assert.match(String(url), /campaignBudgets:mutate$/);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.validateOnly, false); assert.equal(body.operations[0].update.amountMicros, "19990000");
    return json({ results: [{ resourceName: "customers/1234567890/campaignBudgets/8" }] });
  });
});
test("invalid version configuration never sends credentials", async () => {
  const previous = process.env.META_API_VERSION;
  try {
    process.env.META_API_VERSION = "v25.0/../../other";
    await assert.rejects(readCampaign(meta, credentials, async () => { assert.fail("network must not run"); }), /invalid_configuration/);
  } finally { if (previous === undefined) delete process.env.META_API_VERSION; else process.env.META_API_VERSION = previous; }
});
