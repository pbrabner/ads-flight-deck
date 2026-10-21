import test from "node:test";
import assert from "node:assert/strict";
import { listMetaAccounts, getMetaAccount, metaAccountIssue, assertMetaAccountLink } from "./meta-accounts";

const row = { id: "act_123", account_id: "123", name: "Minha conta", currency: "BRL", timezone_name: "America/Sao_Paulo" };
const fake = (handler: (url: string, init?: RequestInit) => unknown): typeof fetch => async (input, init) => Response.json(handler(String(input), init));
test("lists all pages using Bearer and removes token from next URL", async () => {
  const urls: string[] = [];
  const accounts = await listMetaAccounts("secret", fake((url, init) => {
    urls.push(url);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer secret");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.cache, "no-store");
    assert.ok(!url.includes("secret"));
    return urls.length === 1 ? { data: [row], paging: { next: "https://graph.facebook.com/v25.0/me/adaccounts?after=2&access_token=secret" } } : { data: [{ ...row, id: "act_456", account_id: "456" }] };
  }));
  assert.equal(accounts.length, 2);
  assert.deepEqual(accounts[0], { id: "123", name: "Minha conta", currency: "BRL", timezone: "America/Sao_Paulo" });
});
test("rejects unsafe next hosts, paths, credentials and repeated pages", async () => {
  for (const next of ["https://evil.test/v25.0/me/adaccounts", "http://graph.facebook.com/v25.0/me/adaccounts", "https://graph.facebook.com/v25.0/me", "https://x@graph.facebook.com/v25.0/me/adaccounts", "broken"]) {
    let calls = 0;
    await assert.rejects(listMetaAccounts("secret", fake(() => { calls++; return { data: [row], paging: { next } }; })), /invalid_pagination/);
    assert.equal(calls, 1);
  }
  await assert.rejects(listMetaAccounts("secret", fake(url => ({ data: [row], paging: { next: url } }))), /pagination_limit/);
});
test("rejects malformed metadata and sanitizes provider errors", async () => {
  for (const data of [{ ...row, id: "wrong" }, { ...row, account_id: "456" }, { ...row, currency: null }, { ...row, timezone_name: null }, { ...row, name: {} }]) {
    await assert.rejects(listMetaAccounts("secret", fake(() => ({ data: [data] }))), /invalid_response/);
  }
  await assert.rejects(listMetaAccounts("secret", fake(() => ({ error: { code: 190, message: "secret" } }))), { message: "token_invalid" });
});
test("shows currency and timezone incompatibility", () => {
  assert.equal(metaAccountIssue({ currency: "BRL", timezone: "America/Sao_Paulo" }), null);
  assert.ok(metaAccountIssue({ currency: "USD", timezone: "America/Sao_Paulo" }));
  assert.ok(metaAccountIssue({ currency: "BRL", timezone: "Europe/Lisbon" }));
});
test("revalidates selected account directly and prevents identity substitution", async () => {
  assert.equal((await getMetaAccount("secret", "123", fake(url => { assert.match(url, /\/act_123\?/); return row; }))).id, "123");
  await assert.rejects(getMetaAccount("secret", "123", fake(() => ({ ...row, id: "act_456", account_id: "456" }))), /invalid_response/);
  await assert.rejects(getMetaAccount("secret", "../me", fake(() => row)), /invalid/);
});
test("link authorization rejects client ownership, foreign accounts and incompatible metadata", () => {
  const account = { id: "123", name: "Conta", currency: "BRL", timezone: "America/Sao_Paulo" };
  assert.doesNotThrow(() => assertMetaAccountLink({ platform: "meta", owner_client_id: null }, "client-a", account, null));
  assert.doesNotThrow(() => assertMetaAccountLink({ platform: "meta", owner_client_id: "client-a" }, "client-a", account, { client_id: "client-a" }));
  assert.throws(() => assertMetaAccountLink({ platform: "meta", owner_client_id: "client-b" }, "client-a", account, null), /connection_mismatch/);
  assert.throws(() => assertMetaAccountLink({ platform: "google", owner_client_id: null }, "client-a", account, null), /connection_mismatch/);
  assert.throws(() => assertMetaAccountLink({ platform: "meta", owner_client_id: null }, "client-a", account, { client_id: "client-b" }), /account_other_client/);
  assert.throws(() => assertMetaAccountLink({ platform: "meta", owner_client_id: null }, "client-a", { ...account, currency: "USD" }, null), /unsupported_currency_or_timezone/);
});
