import { asRecord, numeric, type Level, type Raw, type DailyMetric, type Connector, type Entity } from "./types";
import { fetchJson } from "./http";
import { isDate } from "../period";
import { normalizeResults } from "../results";
const version = () => process.env.META_API_VERSION || "v25.0";
export function insightsFields(level: Level): string {
  return ["campaign_id", ...(level !== "campaign" ? ["adset_id"] : []), ...(level === "ad" ? ["ad_id"] : []),
    "date_start", "impressions", "clicks", "spend", "reach", "actions", "action_values", "objective", "results"].join(",");
}
export function normalizeMeta(level: Level, row: Raw, actions: string[]): DailyMetric {
  const externalId = row[`${level}_id`];
  if (!externalId || !isDate(row.date_start)) throw new Error("invalid_response");
  const all = Array.isArray(row.actions) ? row.actions.map(asRecord) : [];
  const values = Array.isArray(row.action_values) ? row.action_values.map(asRecord) : [];
  const isConversion = (type: unknown) => /^(lead|onsite_conversion\.|offsite_conversion\.)/.test(String(type));
  return {
    level, externalId: String(externalId), date: row.date_start,
    impressions: numeric(row.impressions), clicks: numeric(row.clicks), spend: numeric(row.spend), reach: numeric(row.reach),
    leads: all.filter(a => actions.includes(String(a.action_type))).reduce((sum, a) => sum + numeric(a.value), 0),
    conversions: all.filter(a => isConversion(a.action_type)).reduce((sum, a) => sum + numeric(a.value), 0),
    conversionValue: values.filter(a => isConversion(a.action_type)).reduce((sum, a) => sum + numeric(a.value), 0),
    results: normalizeResults(row.results), raw: row,
  };
}
export function metaNextUrl(url: string, apiVersion: string): string {
  const target = new URL(url);
  if (target.origin !== "https://graph.facebook.com" || !target.pathname.startsWith(`/${apiVersion}/`) || target.username || target.password) throw new Error("invalid_pagination");
  target.searchParams.delete("access_token");
  return target.toString();
}
async function pages(url: string, accessToken: string): Promise<Raw[]> {
  const rows: Raw[] = [], seen = new Set<string>();
  let next: string | undefined = url;
  while (next) {
    const safe = metaNextUrl(next, version());
    if (seen.has(safe) || seen.size >= 500) throw new Error("pagination_limit");
    seen.add(safe);
    const result = asRecord(await fetchJson(safe, { headers: { Authorization: `Bearer ${accessToken}` } }));
    if (!Array.isArray(result.data)) throw new Error("invalid_response");
    rows.push(...result.data.map(asRecord));
    const following = asRecord(result.paging).next;
    next = typeof following === "string" ? following : undefined;
  }
  return rows;
}
export const meta: Connector = {
  async sync(acct, token, from, to) {
    const id = acct.externalId.replace(/^act_/, "");
    if (!/^\d+$/.test(id) || !isDate(from) || !isDate(to)) throw new Error("invalid_account_or_period");
    const base = `https://graph.facebook.com/${version()}/act_${id}`;
    const account = asRecord(await fetchJson(`${base}?fields=currency,timezone_name`, { headers: { Authorization: `Bearer ${token.accessToken}` } }));
    if (account.currency !== "BRL" || account.timezone_name !== "America/Sao_Paulo") throw new Error("unsupported_currency_or_timezone");
    const entities: Entity[] = [], metrics: DailyMetric[] = [];
    for (const level of ["campaign", "adset", "ad"] as const) {
      const fields = ["id", "name", "effective_status", "campaign_id", ...(level === "ad" ? ["adset_id"] : [])];
      if (level === "campaign") { fields.splice(fields.indexOf("campaign_id"), 1); fields.push("objective"); }
      const list = await pages(`${base}/${level}s?${new URLSearchParams({ fields: fields.join(","), limit: "500" })}`, token.accessToken);
      for (const row of list) {
        if (!row.id) throw new Error("invalid_response");
        entities.push({ level, externalId: String(row.id), name: String(row.name || row.id), status: String(row.effective_status || "UNKNOWN"),
          parentExternalId: level === "campaign" ? undefined : String(row[level === "adset" ? "campaign_id" : "adset_id"] || ""),
          objective: typeof row.objective === "string" ? row.objective : undefined, raw: row });
      }
      const insight = await pages(`${base}/insights?${new URLSearchParams({ fields: insightsFields(level), level, time_increment: "1", time_range: JSON.stringify({ since: from, until: to }), limit: "500" })}`, token.accessToken);
      metrics.push(...insight.map(row => normalizeMeta(level, row, acct.leadActions)));
    }
    return { entities, metrics };
  },
};
