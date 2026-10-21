import type { PlatformFilter } from "@/lib/platform";
import "server-only";
import { notFound } from "next/navigation";
import { requireSession } from "./auth";
import type { Period } from "./period";
import type { EntityMetrics, DailyMetrics } from "./metrics";
import type { CampaignStatus } from "./results";

export async function getClient(slug: string) {
  const session = await requireSession();
  const { data, error } = await session.db.from("clients").select("id,name,slug").eq("slug", slug).maybeSingle();
  if (error) throw new Error("Não foi possível carregar o cliente.");
  if (!data) notFound();
  return { ...session, client: data as { id: string; name: string; slug: string } };
}
export async function getSnapshot(clientId: string, period: Period, level = "campaign", parent: string | null = null, status: CampaignStatus = "all", platform: PlatformFilter = "all") {
  const { db } = await requireSession();
  // Keep combined reports compatible while the database migration is rolled out.
  const platformParams = platform === "all" ? {} : { p_platform: platform };
  const results = await Promise.all([
    db.rpc("report_series", { p_client: clientId, p_from: period.from, p_to: period.to, p_status: status, ...platformParams }),
    db.rpc("report_series", { p_client: clientId, p_from: period.prevFrom, p_to: period.prevTo, p_status: status, ...platformParams }),
    db.rpc("report_entities", { p_client: clientId, p_from: period.from, p_to: period.to, p_level: level, p_parent: parent, p_status: status, ...platformParams }),
  ]);
  if (results.some(r => r.error)) throw new Error("Não foi possível carregar as métricas. Tente novamente.");
  const numbers = <T,>(rows: Record<string, unknown>[]): T[] => rows.map(row => {
    const result = { ...row };
    for (const key of ["spend", "impressions", "clicks", "leads", "ctr", "cpc", "cpl"]) {
      if (key in result && result[key] !== null) result[key] = Number(result[key]);
    }
    return result as T;
  });
  return {
    series: numbers<DailyMetrics>(results[0].data ?? []),
    previous: numbers<DailyMetrics>(results[1].data ?? []),
    entities: numbers<EntityMetrics>(results[2].data ?? []),
  };
}
