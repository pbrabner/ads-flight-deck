import type { CampaignSnapshot, CampaignChange } from "./campaign-provider";

export function budgetMinor(value: string): string {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(normalized)) throw new Error("invalid_budget");
  const [whole, fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (minor <= BigInt(0)) throw new Error("invalid_budget");
  return minor.toString();
}
export type Proposal = { actorId: string; expiresAt: string; before: CampaignSnapshot; change: CampaignChange };
export type ChangeOutcome = "succeeded" | "failed" | "unknown";
export type ExecutionDependencies = {
  claim(): Promise<boolean>;
  read(): Promise<CampaignSnapshot>;
  validate(snapshot: CampaignSnapshot): Promise<void>;
  apply(snapshot: CampaignSnapshot): Promise<void>;
  finish(status: ChangeOutcome, error: string | null, after?: CampaignSnapshot): Promise<void>;
};
export function matchesChange(snapshot: CampaignSnapshot, change: CampaignChange) {
  return change.kind === "status" ? snapshot.status === change.value : snapshot.dailyBudgetMinor === change.value;
}
export function sameSnapshot(a: CampaignSnapshot, b: CampaignSnapshot) {
  return a.name === b.name && a.status === b.status && a.dailyBudgetMinor === b.dailyBudgetMinor && a.budgetRef === b.budgetRef && a.budgetEditable === b.budgetEditable && a.canEdit === b.canEdit;
}
export function changeError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "";
  const allowed = ["no_change", "invalid_budget", "invalid_change", "permission_required", "unsupported_currency_or_timezone", "budget_not_editable", "state_changed", "proposal_invalid", "proposal_expired", "proposal_unavailable", "provider_rejected", "outcome_unknown", "audit_failed", "token_invalid", "campaign_not_found", "target_mismatch", "connection_mismatch", "invalid_credentials", "invalid_configuration"];
  return allowed.includes(message) ? message : "operation_failed";
}
export async function executeCampaignProposal(proposal: Proposal, actorId: string, deps: ExecutionDependencies, now = Date.now()): Promise<void> {
  if (proposal.actorId !== actorId) throw new Error("proposal_invalid");
  if (!Number.isFinite(Date.parse(proposal.expiresAt)) || Date.parse(proposal.expiresAt) <= now) throw new Error("proposal_expired");
  if (!await deps.claim()) throw new Error("proposal_unavailable");
  let status: ChangeOutcome = "failed", error: string | null = null, after: CampaignSnapshot | undefined;
  let writing = false, applied = false;
  try {
    const current = await deps.read();
    if (!sameSnapshot(proposal.before, current)) throw new Error("state_changed");
    await deps.validate(current);
    writing = true;
    await deps.apply(current);
    applied = true;
    after = await deps.read();
    if (!matchesChange(after, proposal.change)) throw new Error("outcome_unknown");
    status = "succeeded";
  } catch (cause) {
    const rejected = !applied && cause instanceof Error && cause.message === "provider_rejected";
    status = writing && !rejected ? "unknown" : "failed";
    error = status === "unknown" ? "outcome_unknown" : changeError(cause);
  }
  // A failed audit write leaves the claim locked; never report a safe retry.
  try { await deps.finish(status, error, after); } catch { throw new Error("audit_failed"); }
}
