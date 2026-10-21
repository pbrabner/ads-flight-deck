import { test } from "node:test";
import assert from "node:assert/strict";
import { authorizationUrl, validOAuthState } from "./oauth";
test("OAuth Google solicita acesso offline com estado e callback exatos", () => {
  const url = new URL(authorizationUrl("google", "client", "https://app.test/api/oauth/google/callback", "random-state"));
  assert.equal(url.searchParams.get("state"), "random-state");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("redirect_uri"), "https://app.test/api/oauth/google/callback");
});
test("OAuth recusa estado ausente, expirado ou de outro administrador", () => {
  const state = { nonce: "abc", user: "u1", owner: null, expires: 1000 };
  assert.equal(validOAuthState(state, "abc", "u1", 999), true);
  assert.equal(validOAuthState(state, "abc", "u2", 999), false);
  assert.equal(validOAuthState(state, "abc", "u1", 1001), false);
  assert.equal(validOAuthState(state, "", "u1", 999), false);
});
test("Meta solicita edição somente no fluxo de gerenciamento", () => {
  assert.equal(new URL(authorizationUrl("meta", "id", "https://app.test/callback", "s")).searchParams.get("scope"), "ads_read");
  assert.equal(new URL(authorizationUrl("meta", "id", "https://app.test/callback", "s", "manage")).searchParams.get("scope"), "ads_read,ads_management");
});
