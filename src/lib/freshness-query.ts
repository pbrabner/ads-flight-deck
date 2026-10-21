import "server-only";
import type { AvailablePlatform } from "./platform";
import { requireSession } from "./auth";
import { adminDb } from "./supabase/admin";
import { accountFreshness, type PlatformFreshness } from "./data-freshness";
import { todayIn } from "./period";

export async function getPlatformFreshness(clientId: string, platform: AvailablePlatform): Promise<PlatformFreshness> {
  const { db, profile } = await requireSession();
  if (profile.role !== "admin" && profile.client_id !== clientId) throw new Error("Cliente não autorizado.");
  // Resolve accessible accounts through RLS before reading operational records with service credentials.
  const found = await db.from("ad_accounts").select("id,external_id,active").eq("client_id", clientId).eq("platform", platform);
  if (found.error) return { accounts: [], unavailable: true };
  const now = new Date();
  const accounts = [];
  // Bound concurrency: two small indexed queries at a time, no global history truncation.
  for (const account of found.data ?? []) {
    try {
      const service = adminDb();
      const columns = "status,started_at,finished_at,from_date,to_date,error";
      const [latest, success] = await Promise.all([
        service.from("sync_runs").select(columns).eq("ad_account_id", account.id).order("started_at", { ascending: false }).limit(1).maybeSingle(),
        service.from("sync_runs").select(columns).eq("ad_account_id", account.id).eq("status", "ok")
          .lte("from_date", todayIn(now)).not("finished_at", "is", null)
          .order("to_date", { ascending: false }).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (latest.error || success.error) throw new Error("unavailable");
      // Never expose raw errors, credentials or unrelated clients' operational records.
      accounts.push(accountFreshness(account, latest.data, success.data, now));
    } catch {
      accounts.push({ id: account.id, externalId: account.external_id, state: "unknown" as const,
        collectedAt: null, from: null, to: null, needsReconnection: false });
    }
  }
  return { accounts, unavailable: false };
}
