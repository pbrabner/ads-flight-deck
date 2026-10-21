import { test } from "node:test";
import assert from "node:assert/strict";
import { budgetMinor, executeCampaignProposal, type Proposal, type ExecutionDependencies } from "./campaign-workflow";

const snapshot = { name: "Campanha", status: "ACTIVE", dailyBudgetMinor: "12345", budgetRef: "budget-1", budgetEditable: true, budgetReason: null, canEdit: true };
const proposal: Proposal = { actorId: "admin", expiresAt: new Date(2000).toISOString(), before: snapshot, change: { kind: "status", value: "PAUSED" } };
function setup() {
  const calls: string[] = []; let status = "ACTIVE";
  const deps: ExecutionDependencies = {
    claim: async () => { calls.push("claim"); return true; },
    read: async () => { calls.push("read"); return { ...snapshot, status }; },
    validate: async () => { calls.push("validate"); },
    apply: async () => { calls.push("apply"); status = "PAUSED"; },
    finish: async (state, error) => { calls.push(`${state}:${error || ""}`); },
  };
  return { deps, calls };
}
test("orçamento converte reais para centavos exatos e rejeita formatos ambíguos", () => {
  assert.equal(budgetMinor("123,45"), "12345"); assert.equal(budgetMinor("10.5"), "1050");
  for (const value of ["", "0", "-1", "1.000,00", "2e3", "NaN", "1.001"]) assert.throws(() => budgetMinor(value));
});
test("confirmação exige ator, prazo e claim de uso único antes de escrever", async () => {
  const { deps, calls } = setup();
  await assert.rejects(executeCampaignProposal(proposal, "outro", deps, 1000), /proposal_invalid/);
  await assert.rejects(executeCampaignProposal(proposal, "admin", deps, 2000), /proposal_expired/);
  deps.claim = async () => false;
  await assert.rejects(executeCampaignProposal(proposal, "admin", deps, 1000), /proposal_unavailable/);
  assert.deepEqual(calls, []);
});
test("estado alterado depois da prévia impede escrita", async () => {
  const { deps, calls } = setup(); deps.read = async () => ({ ...snapshot, dailyBudgetMinor: "999" });
  await executeCampaignProposal(proposal, "admin", deps, 1000);
  assert.ok(calls.includes("failed:state_changed")); assert.ok(!calls.includes("apply"));
});
test("execução confirma resultado por leitura e grava sucesso", async () => {
  const { deps, calls } = setup(); await executeCampaignProposal(proposal, "admin", deps, 1000);
  assert.deepEqual(calls, ["claim", "read", "validate", "apply", "read", "succeeded:"]);
});
test("timeout na escrita fica incerto e não repete operação", async () => {
  const { deps, calls } = setup(); deps.apply = async () => { calls.push("apply"); throw new Error("outcome_unknown"); };
  await executeCampaignProposal(proposal, "admin", deps, 1000);
  assert.equal(calls.filter(c => c === "apply").length, 1); assert.ok(calls.includes("unknown:outcome_unknown"));
});
test("falha de leitura após escrita aceita mantém resultado incerto", async () => {
  const { deps, calls } = setup(); let reads = 0;
  deps.read = async () => { if (++reads > 1) throw new Error("provider_rejected"); return snapshot; };
  await executeCampaignProposal(proposal, "admin", deps, 1000);
  assert.equal(calls.filter(c => c === "apply").length, 1);
  assert.ok(calls.includes("unknown:outcome_unknown"));
  assert.ok(!calls.includes("failed:provider_rejected"));
});
test("recusa explícita é falha e falha no registro posterior não vira tentativa segura", async () => {
  const { deps, calls } = setup(); deps.apply = async () => { throw new Error("provider_rejected"); };
  await executeCampaignProposal(proposal, "admin", deps, 1000); assert.ok(calls.includes("failed:provider_rejected"));
  const second = setup(); second.deps.finish = async () => { throw new Error("database_error"); };
  await assert.rejects(executeCampaignProposal(proposal, "admin", second.deps, 1000), /audit_failed/);
  assert.equal(second.calls.filter(c => c === "apply").length, 1);
});
