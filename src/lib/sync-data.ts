import type { Level, Platform, SyncResult, DailyMetric } from "./connectors/types";
type EntityWrite = { name: string; ad_account_id: string; platform: string; level: string; external_id: string; status: string; parent_id?: string | null; objective?: string | null; raw: object };
export function entityWrites(data: SyncResult, account: string, platform: Platform, level: Level, ids: Map<string,string>): { actual: EntityWrite[]; placeholders: EntityWrite[] } {
  const actual = [...new Map(data.entities.filter(e => e.level === level).map(e => [e.externalId, e])).values()].map(e => ({
    ad_account_id: account, platform, level, external_id: e.externalId, name: e.name, status: e.status,
    parent_id: e.parentExternalId ? ids.get(`${level === "ad" ? "adset" : "campaign"}:${e.parentExternalId}`) ?? null : null,
    objective: e.objective || null, raw: e.raw,
  }));
  const actualIds = new Set(actual.map(e => e.external_id));
  const missing = new Set(data.metrics.filter(m => m.level === level && !actualIds.has(m.externalId)).map(m => m.externalId));
  const childLevel = level === "campaign" ? "adset" : level === "adset" ? "ad" : null;
  for (const e of data.entities) if (e.level === childLevel && e.parentExternalId && !actualIds.has(e.parentExternalId)) missing.add(e.parentExternalId);
  return { actual, placeholders: [...missing].map(external_id => ({ ad_account_id: account, platform, level, external_id, name: external_id, status: "UNKNOWN", raw: {} })) };
}
export function metricWrites(metrics: DailyMetric[], ids: Map<string,string>): Record<string,unknown>[] {
  return metrics.map(m => {
    const id = ids.get(`${m.level}:${m.externalId}`);
    if (!id) throw new Error("unresolved_entity");
    return { entity_id: id, date: m.date, spend: m.spend, impressions: m.impressions, clicks: m.clicks, leads: m.leads,
      conversions: m.conversions, conversion_value: m.conversionValue, reach: m.reach ?? null, results: m.results ?? null, raw: m.raw };
  });
}
export function safeSyncError(error: unknown): string {
  const value = error instanceof Error ? error.message : "";
  return /^(token_invalid|rate_limited|network_timeout|invalid_response|invalid_metric|invalid_pagination|pagination_limit|unsupported_currency_or_timezone|sync_in_progress|connection_mismatch|unresolved_entity|upstream_\d{3})$/.test(value) ? value : "sync_failed";
}
