import test from "node:test";
import assert from "node:assert/strict";
import { listGoogleAccounts, getGoogleAccount, googleAccountIssue, assertGoogleAccountLink } from "./google-accounts";

const customer = (id: string, manager = false) => ({ id, descriptiveName: `Conta ${id}`, currencyCode: "BRL", timeZone: "America/Sao_Paulo", manager });
const fake = (handler: (url: string, init?: RequestInit) => unknown): typeof fetch => async (input, init) => Response.json(handler(String(input), init));
test("discovers direct accounts and nested MCC clients, deduplicating and retaining the direct route", async () => {
  const calls: string[] = [];
  const result = await listGoogleAccounts("secret", fake((url, init) => {
    calls.push(url);
    assert.equal(new URL(url).origin, "https://googleads.googleapis.com");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("authorization"), "Bearer secret");
    assert.equal(headers.get("developer-token"), null);
    if (url.endsWith("customers:listAccessibleCustomers")) { assert.equal(headers.get("login-customer-id"), null); return { resourceNames: ["customers/1", "customers/4"] }; }
    const id = url.match(/customers\/(\d+)/)![1];
    const query = JSON.parse(String(init?.body)).query as string;
    if (!query.includes("FROM customer_client")) return [{ results: [{ customer: customer(id, id === "1") }] }];
    assert.equal(headers.get("login-customer-id"), "1");
    assert.match(query, /customer_client.level <= 1/);
    return [{ results: (id === "1" ? [customer("1", true), customer("2", true), customer("4")] : [customer("2", true), customer("3"), customer("1", true)]).map(c => ({ customerClient: { ...c, level: c.id === id ? "0" : "1", clientCustomer: `customers/${c.id}` } })) }];
  }));
  assert.equal(result.warnings.length, 0);
  assert.equal(result.accounts.length, 4);
  assert.equal(result.accounts.find(a => a.id === "3")?.loginCustomerId, "1");
  assert.equal(result.accounts.find(a => a.id === "4")?.loginCustomerId, undefined);
  assert.equal(calls.length, 5);
});
test("partial discovery failure is visible and invalid tokens never appear as empty results", async () => {
  const result = await listGoogleAccounts("secret", fake(url => url.endsWith("customers:listAccessibleCustomers") ? { resourceNames: ["customers/1", "customers/2"] } : url.includes("/1/") ? { error: { message: "secret", code: 403 } } : [{ results: [{ customer: customer("2") }] }]));
  assert.equal(result.accounts.length, 1);
  assert.deepEqual(result.warnings, ["account_discovery_failed"]);
  await assert.rejects(listGoogleAccounts("secret", async () => Response.json({ error: { message: "secret" } }, { status: 401 })), { message: "token_invalid" });
});

test("production access restriction is identified without discarding accessible test accounts", async () => {
  for (const [authorizationError, message, stream] of [
    ["ACTION_NOT_PERMITTED", "The Google Cloud project is only approved for use with test accounts. To access non-test accounts, apply for Explorer, Basic or Standard access.", true],
    ["CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION", "SECRET upstream details", false],
  ] as const) {
    const result = await listGoogleAccounts("secret", async input => {
      const url = String(input);
      if (url.endsWith("customers:listAccessibleCustomers")) return Response.json({ resourceNames: ["customers/1", "customers/2"] });
      if (url.includes("/2/")) return Response.json([{ results: [{ customer: customer("2") }] }]);
      const error = { error: { code: 403, details: [{ errors: [{ errorCode: { authorizationError }, message }] }] } };
      return Response.json(stream ? [error] : error, { status: 403 });
    });
    assert.deepEqual(result.warnings, ["google_production_access_required"]);
    assert.deepEqual(result.accounts.map(a => a.id), ["2"]);
  }
});

test("other ACTION_NOT_PERMITTED errors remain generic", async () => {
  const result = await listGoogleAccounts("secret", async input => String(input).endsWith("customers:listAccessibleCustomers")
    ? Response.json({ resourceNames: ["customers/1"] })
    : Response.json([{ error: { details: [{ errors: [{ errorCode: { authorizationError: "ACTION_NOT_PERMITTED" }, message: "SECRET other permission failure" }] }] } }], { status: 403 }));
  assert.deepEqual(result.warnings, ["account_discovery_failed"]);
});
test("bounds the manager traversal and reports truncation", async () => {
  let queries = 0;
  const result = await listGoogleAccounts("secret", fake((url, init) => {
    if (url.endsWith("customers:listAccessibleCustomers")) return { resourceNames: ["customers/1"] };
    queries++;
    const id = url.match(/customers\/(\d+)/)![1];
    if (!String(init?.body).includes("customer_client")) return [{ results: [{ customer: customer(id, true) }] }];
    const next = String(Number(id) + 1);
    return [{ results: [{ customerClient: { ...customer(next, true), clientCustomer: `customers/${next}`, level: "1" } }] }];
  }));
  assert.ok(queries <= 12);
  assert.ok(result.warnings.includes("discovery_limit"));
});
test("limits direct-account queries and rejects malformed metadata without hiding failures", async () => {
  let queries = 0;
  const result = await listGoogleAccounts("secret", fake(url => {
    if (url.endsWith("customers:listAccessibleCustomers")) return { resourceNames: Array.from({ length: 105 }, (_, i) => `customers/${i + 1}`) };
    queries++;
    const id = url.match(/customers\/(\d+)/)![1];
    return [{ results: [{ customer: customer(id) }] }];
  }));
  assert.equal(queries, 100);
  assert.equal(result.accounts.length, 100);
  assert.deepEqual(result.warnings, ["discovery_limit"]);
  for (const invalid of [{ ...customer("1"), currencyCode: null }, { ...customer("1"), timeZone: "" }, { ...customer("1"), manager: "false" }]) {
    await assert.rejects(getGoogleAccount("secret", "1", undefined, fake(() => [{ results: [{ customer: invalid }] }])), /invalid_response/);
  }
});
test("rejects invalid API configuration before issuing a request", async (t) => {
  const original = process.env.GOOGLE_ADS_API_VERSION;
  t.after(() => { if (original === undefined) delete process.env.GOOGLE_ADS_API_VERSION; else process.env.GOOGLE_ADS_API_VERSION = original; });
  process.env.GOOGLE_ADS_API_VERSION = "v26/../../evil";
  await assert.rejects(listGoogleAccounts("secret", fake(() => { throw new Error("must not request"); })), /invalid_configuration/);
});
test("validates resource names, returned identity and selected login route", async () => {
  await assert.rejects(listGoogleAccounts("secret", fake(() => ({ resourceNames: ["https://evil.test"] }))), /invalid_response/);
  for (const id of ["../1", "1-2", "", "9".repeat(41)]) await assert.rejects(getGoogleAccount("secret", id, undefined, fake(() => [])), /invalid/);
  await assert.rejects(getGoogleAccount("secret", "1", "../2", fake(() => [])), /invalid/);
  await assert.rejects(getGoogleAccount("secret", "1", undefined, fake(() => [{ results: [{ customer: customer("2") }] }])), /invalid_response/);
  const account = await getGoogleAccount("secret", "1", "2", fake((url, init) => {
    assert.match(url, /customers\/1\/googleAds:searchStream$/);
    assert.equal(new Headers(init?.headers).get("login-customer-id"), "2");
    return [{ results: [{ customer: customer("1") }] }];
  }));
  assert.equal(account.loginCustomerId, "2");
});
test("rejects foreign ownership, platform substitution, manager accounts and incompatible metadata", () => {
  const account = { id: "1", name: "Conta", currency: "BRL", timezone: "America/Sao_Paulo" };
  assert.equal(googleAccountIssue(account), null);
  assert.doesNotThrow(() => assertGoogleAccountLink({ platform: "google", owner_client_id: null }, "a", account, null));
  assert.doesNotThrow(() => assertGoogleAccountLink({ platform: "google", owner_client_id: "a" }, "a", account, { client_id: "a" }));
  assert.throws(() => assertGoogleAccountLink({ platform: "meta", owner_client_id: null }, "a", account, null), /connection_mismatch/);
  assert.throws(() => assertGoogleAccountLink({ platform: "google", owner_client_id: "b" }, "a", account, null), /connection_mismatch/);
  assert.throws(() => assertGoogleAccountLink({ platform: "google", owner_client_id: null }, "a", account, { client_id: "b" }), /account_other_client/);
  for (const invalid of [{ ...account, manager: true }, { ...account, currency: "USD" }, { ...account, timezone: "Europe/Lisbon" }]) assert.throws(() => assertGoogleAccountLink({ platform: "google", owner_client_id: null }, "a", invalid, null), /unsupported_account/);
});
