import { test } from "node:test";
import assert from "node:assert/strict";
import { accountSchema, clientSchema, profileSchema, connectionRemovalSchema, normalizeAccountId, canLinkConnection, safeReturnPath } from "./validation";

test("remoção exige ID válido e confirmação explícita", () => {
  const id = "30000000-0000-4000-8000-000000000001";
  assert.equal(connectionRemovalSchema.safeParse({ id }).success, false);
  assert.equal(connectionRemovalSchema.safeParse({ id, confirmation: "false" }).success, false);
  assert.equal(connectionRemovalSchema.safeParse({ id: "", confirmation: "remove" }).success, false);
  assert.equal(connectionRemovalSchema.safeParse({ id, confirmation: "remove" }).success, true);
});

test("slugs e perfis inválidos são recusados", () => {
  assert.equal(clientSchema.safeParse({ name: "A", slug: "../admin" }).success, false);
  assert.equal(profileSchema.safeParse({ email: "a@example.com", role: "client", client_id: "" }).success, false);
});
test("normalização de IDs não aceita URL arbitrária", () => {
  assert.equal(normalizeAccountId("meta", "act_123"), "123");
  assert.equal(normalizeAccountId("google", "123-456-7890"), "1234567890");
  assert.equal(accountSchema.safeParse({ platform: "meta", external_id: "https://example.com" }).success, false);
});
test("conexão privada só pode atender ao seu cliente e plataforma", () => {
  assert.equal(canLinkConnection({ platform: "meta", owner_client_id: "A" }, { platform: "meta", client_id: "B" }), false);
  assert.equal(canLinkConnection({ platform: "meta", owner_client_id: null }, { platform: "google", client_id: "A" }), false);
  assert.equal(canLinkConnection({ platform: "meta", owner_client_id: null }, { platform: "meta", client_id: "A" }), true);
});
test("retorno de login não permite redirecionamento externo", () => {
  assert.equal(safeReturnPath("//evil.com"), "/");
  assert.equal(safeReturnPath("/\\evil.com"), "/");
  assert.equal(safeReturnPath("/c/acme?range=7d"), "/c/acme?range=7d");
});
