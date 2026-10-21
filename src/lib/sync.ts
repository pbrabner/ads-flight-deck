import "server-only";
import { adminDb } from "./supabase/admin";
import { meta } from "./connectors/meta";
import { google } from "./connectors/google";
import type { Platform, SyncResult, Token } from "./connectors/types";
import { entityWrites, metricWrites, safeSyncError } from "./sync-data";
import { addDays, chunkRange, todayIn } from "./period";
import { canLinkConnection } from "./validation";

type Account = { id: string; client_id: string; connection_id: string; platform: Platform; external_id: string; lead_actions: string[]; login_customer_id: string | null };
export type SyncSummary = { account: string; rows?: number; error?: string };
type DB = ReturnType<typeof adminDb>;
function check(error: { message: string } | null) { if (error) throw new Error("database_error"); }
async function persist(db: DB, account: Account, data: SyncResult, from: string, to: string) {
  const ids = new Map<string, string>();
  for (const level of ["campaign", "adset", "ad"] as const) {
    const writes = entityWrites(data, account.id, account.platform, level, ids);
    for (const [rows, ignore] of [[writes.actual, false], [writes.placeholders, true]] as const) {
      for (let i = 0; i < rows.length; i += 250) {
        const batch = rows.slice(i, i + 250);
        const { error } = await db.from("entities").upsert(batch, { onConflict: "ad_account_id,level,external_id", ignoreDuplicates: ignore });
        check(error);
        const result = await db.from("entities").select("id,external_id").eq("ad_account_id", account.id).eq("level", level).in("external_id", batch.map(row => row.external_id));
        check(result.error);
        for (const entity of result.data || []) ids.set(`${level}:${entity.external_id}`, entity.id);
      }
    }
  }
  const rows = metricWrites(data.metrics, ids);
  // shortcut: one 30-day report per RPC; move to staged uploads if large accounts exceed request limits.
  check((await db.rpc("replace_account_metrics", { p_account: account.id, p_from: from, p_to: to, p_rows: rows })).error);
  return rows.length;
}
export async function syncAccount(account: Account, from: string, to: string): Promise<number> {
  const db = adminDb();
  // A terminated serverless request leaves a lease; only leases older than the maximum runtime are recovered.
  const stale = await db.from("sync_runs").update({ status: "error", error: "interrupted", finished_at: new Date().toISOString() })
    .eq("ad_account_id", account.id).eq("status", "running").lt("started_at", new Date(Date.now() - 10 * 60_000).toISOString());
  check(stale.error);
  const { data: run, error: beginError } = await db.from("sync_runs").insert({ ad_account_id: account.id, from_date: from, to_date: to }).select("id").single();
  if (beginError?.code === "23505") throw new Error("sync_in_progress");
  check(beginError);
  if (!run) throw new Error("database_error");
  try {
    const { data: connection, error } = await db.from("connections").select("*").eq("id", account.connection_id).single();
    check(error);
    if (!connection || !canLinkConnection(connection, account)) throw new Error("connection_mismatch");
    const token: Token = { accessToken: connection.access_token || "", refreshToken: connection.refresh_token || undefined,
      loginCustomerId: account.login_customer_id ?? undefined };
    const result = await (account.platform === "meta" ? meta : google).sync({ externalId: account.external_id, leadActions: account.lead_actions }, token, from, to);
    const rows = await persist(db, account, result, from, to);
    const warning = connection.expires_at && !connection.refresh_token && Date.parse(connection.expires_at) - Date.now() < 10 * 86_400_000 ? "token_expiring" : null;
    check((await db.from("sync_runs").update({ status: "ok", rows, error: warning, finished_at: new Date().toISOString() }).eq("id", run.id)).error);
    return rows;
  } catch (error) {
    const { error: logError } = await db.from("sync_runs").update({ status: "error", error: safeSyncError(error), finished_at: new Date().toISOString() }).eq("id", run.id);
    if (logError) throw new Error("database_error");
    throw error;
  }
}
export async function syncAll(accountId?: string, from = addDays(todayIn(), -6), to = todayIn()): Promise<SyncSummary[]> {
  const db = adminDb();
  let query = db.from("ad_accounts").select("id,client_id,connection_id,platform,external_id,lead_actions,login_customer_id").eq("active", true);
  if (accountId) query = query.eq("id", accountId);
  const { data, error } = await query;
  check(error);
  if (accountId && !data?.length) throw new Error("account_not_found");
  const summary: SyncSummary[] = [];
  for (const account of (data || []) as Account[]) {
    let rows = 0;
    try {
      for (const window of chunkRange(from, to)) rows += await syncAccount(account, window.from, window.to);
      summary.push({ account: account.id, rows });
    } catch (error) { summary.push({ account: account.id, error: safeSyncError(error) }); }
  }
  return summary;
}
