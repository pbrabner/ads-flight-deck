import { addDays, todayIn } from "./period";

export type SyncRecord = {
  status: string; started_at: string; finished_at: string | null;
  from_date: string; to_date: string; error?: string | null;
};
export type AccountFreshness = {
  id: string; externalId: string;
  state: "recent" | "stale" | "error" | "running" | "interrupted" | "waiting" | "disabled" | "unknown";
  collectedAt: string | null; from: string | null; to: string | null;
  needsReconnection: boolean;
};
export type PlatformFreshness = { accounts: AccountFreshness[]; unavailable: boolean };

// Daily collection plus a 12-hour tolerance. This is operational freshness, not report coverage.
export const STALE_AFTER_MS = 36 * 60 * 60_000;
export function accountFreshness(
  account: { id: string; external_id: string; active: boolean },
  latest: SyncRecord | null, success: SyncRecord | null, now = new Date(),
): AccountFreshness {
  const collectedAt = success?.status === "ok" && success.finished_at && Number.isFinite(Date.parse(success.finished_at)) ? success.finished_at : null;
  let state: AccountFreshness["state"];
  if (!account.active) state = "disabled";
  else if (latest?.status === "running") {
    const age = now.getTime() - Date.parse(latest.started_at);
    state = Number.isFinite(age) && age >= 0 && age <= 10 * 60_000 ? "running" : "interrupted";
  } else if (latest?.status === "error") state = "error";
  else if (!collectedAt) state = "waiting";
  else {
    const age = now.getTime() - Date.parse(collectedAt);
    state = age < 0 || age > STALE_AFTER_MS || success!.to_date < addDays(todayIn(now), -1) ? "stale" : "recent";
  }
  return {
    id: account.id, externalId: account.external_id, state, collectedAt,
    from: collectedAt ? success!.from_date : null, to: collectedAt ? success!.to_date : null,
    needsReconnection: latest?.error === "token_invalid" || latest?.error === "token_expiring",
  };
}
