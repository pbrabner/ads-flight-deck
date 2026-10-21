import { asRecord, numeric, type Level, type Raw, type Token, type SyncResult, type DailyMetric, type Connector } from "./types";
import { fetchJson } from "./http";
import { requiredEnv } from "../env";
import { isDate } from "../period";

function identity(level: Level, row: Raw) {
  const campaign = asRecord(row.campaign), group = asRecord(row.adGroup), adGroupAd = asRecord(row.adGroupAd), ad = asRecord(adGroupAd.ad);
  const rawId = level === "campaign" ? campaign.id : level === "adset" ? group.id : ad.id;
  if (!rawId || (level === "ad" && !group.id)) throw new Error("invalid_response");
  return { externalId: level === "ad" ? `${group.id}:${ad.id}` : String(rawId),
    parentExternalId: level === "campaign" ? undefined : String(level === "adset" ? campaign.id : group.id),
    name: String((level === "campaign" ? campaign.name : level === "adset" ? group.name : ad.name) || rawId),
    status: String((level === "campaign" ? campaign.status : level === "adset" ? group.status : adGroupAd.status) || "UNKNOWN"),
    objective: String(campaign.advertisingChannelType || "") };
}
export function normalizeGoogle(level: Level, rows: Raw[]): SyncResult {
  const entities = new Map<string, SyncResult["entities"][number]>(), metrics: DailyMetric[] = [];
  for (const row of rows) {
    const entity = identity(level, row);
    entities.set(entity.externalId, { ...entity, level, raw: row });
    const segments = asRecord(row.segments), values = asRecord(row.metrics);
    if (segments.date !== undefined) {
      if (!isDate(segments.date)) throw new Error("invalid_response");
      metrics.push({ level, externalId: entity.externalId, date: segments.date, spend: numeric(values.costMicros) / 1_000_000,
        impressions: numeric(values.impressions), clicks: numeric(values.clicks), leads: numeric(values.conversions),
        conversions: numeric(values.conversions), conversionValue: numeric(values.conversionsValue), results: [{ type: "google:conversions", value: numeric(values.conversions) }], raw: row });
    }
  }
  return { entities: [...entities.values()], metrics };
}
// Developer tokens were retired in September 2026; retain the argument for old callers.
export function googleHeaders(token: Token, developerToken?: string): Record<string, string> {
  void developerToken;
  return { Authorization: `Bearer ${token.accessToken}`, "Content-Type": "application/json",
    ...(token.loginCustomerId ? { "login-customer-id": token.loginCustomerId.replaceAll("-", "") } : {}) };
}
export function applyLeadActions(metrics: DailyMetric[], level: Level, rows: Raw[], actions: string[]): void {
  const leads = new Map<string, number>();
  for (const row of rows) {
    const segment = asRecord(row.segments);
    if (!actions.includes(String(segment.conversionActionName))) continue;
    const key = `${identity(level, row).externalId}|${segment.date}`;
    leads.set(key, (leads.get(key) || 0) + numeric(asRecord(row.metrics).conversions));
  }
  for (const metric of metrics) {
    metric.leads = leads.get(`${metric.externalId}|${metric.date}`) || 0;
    metric.results = [{ type: "google:conversions", value: metric.leads }];
  }
}
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const data = asRecord(await fetchJson("https://oauth2.googleapis.com/token", { method: "POST",
    body: new URLSearchParams({ client_id: requiredEnv("GOOGLE_CLIENT_ID"), client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"), refresh_token: refreshToken, grant_type: "refresh_token" }) }));
  if (typeof data.access_token !== "string") throw new Error("invalid_response");
  return data.access_token;
}
export const google: Connector = {
  async sync(acct, token, from, to) {
    const id = acct.externalId.replaceAll("-", "");
    if (!/^\d+$/.test(id) || !isDate(from) || !isDate(to)) throw new Error("invalid_account_or_period");
    if (!token.refreshToken) throw new Error("token_invalid");
    const accessToken = await refreshAccessToken(token.refreshToken);
    const headers = googleHeaders({ ...token, accessToken });
    const version = process.env.GOOGLE_ADS_API_VERSION || "v26";
    if (!/^v\d+$/.test(version)) throw new Error("invalid_configuration");
    const url = `https://googleads.googleapis.com/${version}/customers/${id}/googleAds:searchStream`;
    async function query(gaql: string): Promise<Raw[]> {
      const data = await fetchJson(url, { method: "POST", headers, body: JSON.stringify({ query: gaql }) });
      if (!Array.isArray(data)) throw new Error("invalid_response");
      return data.flatMap(chunk => {
        const results = asRecord(chunk).results;
        if (results === undefined) return [];
        if (!Array.isArray(results)) throw new Error("invalid_response");
        return results.map(asRecord);
      });
    }
    const account = asRecord((await query("SELECT customer.currency_code, customer.time_zone FROM customer LIMIT 1"))[0]?.customer);
    if (account.currencyCode !== "BRL" || account.timeZone !== "America/Sao_Paulo") throw new Error("unsupported_currency_or_timezone");
    const all: SyncResult = { entities: [], metrics: [] };
    for (const level of ["campaign", "adset", "ad"] as const) {
      const resource = level === "campaign" ? "campaign" : level === "adset" ? "ad_group" : "ad_group_ad";
      const fields = ["campaign.id", "campaign.name", "campaign.status", "campaign.advertising_channel_type",
        ...(level !== "campaign" ? ["ad_group.id", "ad_group.name", "ad_group.status"] : []),
        ...(level === "ad" ? ["ad_group_ad.ad.id", "ad_group_ad.ad.name", "ad_group_ad.status"] : [])];
      const ids = ["campaign.id", ...(level !== "campaign" ? ["ad_group.id"] : []), ...(level === "ad" ? ["ad_group_ad.ad.id"] : [])];
      const listed = normalizeGoogle(level, await query(`SELECT ${fields.join(", ")} FROM ${resource} WHERE ${resource}.status != 'REMOVED'`));
      const measured = normalizeGoogle(level, await query(`SELECT ${fields.join(", ")}, segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM ${resource} WHERE segments.date BETWEEN '${from}' AND '${to}'`));
      if (acct.leadActions.length) {
        const segmented = await query(`SELECT ${ids.join(", ")}, segments.date, segments.conversion_action_name, metrics.conversions FROM ${resource} WHERE segments.date BETWEEN '${from}' AND '${to}'`);
        applyLeadActions(measured.metrics, level, segmented, acct.leadActions);
      }
      // Historical reports carry metadata for removed entities; current listings take precedence.
      const entities = new Map([...measured.entities, ...listed.entities].map(entity => [entity.externalId, entity]));
      all.entities.push(...entities.values());
      all.metrics.push(...measured.metrics);
    }
    return all;
  },
};
