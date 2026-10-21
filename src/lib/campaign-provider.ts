import { fetchJson } from "./connectors/http";
import { asRecord } from "./connectors/types";

export type CampaignTarget = { platform: "meta" | "google"; accountId: string; campaignId: string; loginCustomerId?: string };
export type CampaignCredentials = { accessToken: string };
export type CampaignSnapshot = { name: string; status: string; dailyBudgetMinor: string | null; budgetRef: string | null; budgetEditable: boolean; budgetReason: string | null; canEdit: boolean };
export type CampaignChange = { kind: "status"; value: "ACTIVE" | "PAUSED" } | { kind: "daily_budget"; value: string };
export type CampaignProviderErrorCode = "invalid_target" | "invalid_configuration" | "invalid_credentials" | "invalid_response" | "target_mismatch" | "campaign_not_found" | "unsupported_currency_or_timezone" | "permission_required" | "invalid_change" | "budget_not_editable" | "provider_rejected" | "outcome_unknown";
export class CampaignProviderError extends Error {
  constructor(readonly code: CampaignProviderErrorCode) { super(code); this.name = "CampaignProviderError"; }
}
function fail(code: CampaignProviderErrorCode): never { throw new CampaignProviderError(code); }
const MAX_INT64 = BigInt("9223372036854775807");
function integer(value: unknown): bigint | null {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) return null;
  if ((typeof value !== "string" && typeof value !== "number") || !/^\d{1,20}$/.test(String(value))) return null;
  const result = BigInt(value); return result <= MAX_INT64 ? result : null;
}
function config(target: CampaignTarget, credentials: CampaignCredentials) {
  if (!["meta", "google"].includes(target.platform) || !/^\d{1,40}$/.test(target.accountId) || !/^\d{1,40}$/.test(target.campaignId)
    || (target.loginCustomerId !== undefined && !/^\d{1,40}$/.test(target.loginCustomerId))) fail("invalid_target");
  if (!credentials.accessToken || /[\r\n]/.test(credentials.accessToken)) fail("invalid_credentials");
  const version = target.platform === "meta" ? process.env.META_API_VERSION || "v25.0" : process.env.GOOGLE_ADS_API_VERSION || "v26";
  if (!(target.platform === "meta" ? /^v\d+\.\d+$/ : /^v\d+$/).test(version)) fail("invalid_configuration");
  const headers = { Authorization: `Bearer ${credentials.accessToken}`, ...(target.platform === "google" && target.loginCustomerId ? { "login-customer-id": target.loginCustomerId } : {}) };
  return { base: target.platform === "meta" ? `https://graph.facebook.com/${version}` : `https://googleads.googleapis.com/${version}/customers/${target.accountId}`, headers };
}
async function readJson(url: string, init: RequestInit, fetcher: typeof fetch) {
  try { return await fetchJson(url, init, fetcher); }
  catch { fail("provider_rejected"); }
}
function checkAccount(currency: unknown, timezone: unknown) {
  if (currency !== "BRL" || timezone !== "America/Sao_Paulo") fail("unsupported_currency_or_timezone");
}
async function metaPermission(base: string, headers: HeadersInit, fetcher: typeof fetch): Promise<boolean> {
  const result = asRecord(await readJson(`${base}/me/permissions`, { headers }, fetcher));
  if (!Array.isArray(result.data)) fail("invalid_response");
  return result.data.some(value => { const row = asRecord(value); return row.permission === "ads_management" && row.status === "granted"; });
}

/** Call on the server with freshly refreshed credentials. No writes are performed. */
export async function readCampaign(target: CampaignTarget, credentials: CampaignCredentials, fetcher: typeof fetch = fetch): Promise<CampaignSnapshot> {
  const { base, headers } = config(target, credentials);
  if (target.platform === "meta") {
    const account = asRecord(await readJson(`${base}/act_${target.accountId}?fields=id,account_id,currency,timezone_name`, { headers }, fetcher));
    if (account.id !== `act_${target.accountId}` || (account.account_id !== undefined && account.account_id !== target.accountId)) fail("target_mismatch");
    checkAccount(account.currency, account.timezone_name);
    const campaign = asRecord(await readJson(`${base}/${target.campaignId}?fields=id,account_id,name,status,daily_budget,lifetime_budget`, { headers }, fetcher));
    if (campaign.id !== target.campaignId || campaign.account_id !== target.accountId) fail("target_mismatch");
    if (typeof campaign.name !== "string" || typeof campaign.status !== "string") fail("invalid_response");
    const daily = integer(campaign.daily_budget ?? "0"), lifetime = integer(campaign.lifetime_budget ?? "0");
    const budgetReason = daily === null || lifetime === null ? "invalid_budget" : lifetime > BigInt(0) ? "lifetime_budget" : daily === BigInt(0) ? "adset_budget" : null;
    const canEdit = (await metaPermission(base, headers, fetcher)) && ["ACTIVE", "PAUSED"].includes(campaign.status);
    return { name: campaign.name, status: campaign.status, dailyBudgetMinor: daily !== null && daily > BigInt(0) ? String(daily) : null,
      budgetRef: daily !== null && daily > BigInt(0) ? target.campaignId : null, budgetEditable: budgetReason === null, budgetReason, canEdit };
  }
  const query = `SELECT customer.id, customer.currency_code, customer.time_zone, campaign.id, campaign.resource_name, campaign.name, campaign.status, campaign.campaign_budget, campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared, campaign_budget.reference_count, campaign_budget.period FROM campaign WHERE campaign.id = ${target.campaignId}`;
  const data = await readJson(`${base}/googleAds:searchStream`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ query }) }, fetcher);
  if (!Array.isArray(data)) fail("invalid_response");
  const rows = data.flatMap(chunk => { const values = asRecord(chunk).results; if (values === undefined) return []; if (!Array.isArray(values)) fail("invalid_response"); return values; });
  if (!rows.length) fail("campaign_not_found");
  if (rows.length !== 1) fail("invalid_response");
  const row = asRecord(rows[0]), account = asRecord(row.customer), campaign = asRecord(row.campaign), budget = asRecord(row.campaignBudget);
  if (String(account.id) !== target.accountId || String(campaign.id) !== target.campaignId || campaign.resourceName !== `customers/${target.accountId}/campaigns/${target.campaignId}`) fail("target_mismatch");
  checkAccount(account.currencyCode, account.timeZone);
  if (typeof campaign.name !== "string" || typeof campaign.status !== "string") fail("invalid_response");
  const budgetRef = typeof budget.resourceName === "string" ? budget.resourceName : null;
  if (budgetRef && (!new RegExp(`^customers/${target.accountId}/campaignBudgets/\\d+$`).test(budgetRef) || campaign.campaignBudget !== budgetRef)) fail("target_mismatch");
  const micros = integer(budget.amountMicros), referenceCount = integer(budget.referenceCount);
  const daily = micros !== null && micros % BigInt(10000) === BigInt(0) ? micros / BigInt(10000) : null;
  const budgetReason = budget.explicitlyShared === true || (referenceCount !== null && referenceCount > BigInt(1)) ? "shared_budget"
    : budget.period !== "DAILY" ? "non_daily_budget"
      : !budgetRef || daily === null || daily <= BigInt(0) || referenceCount === null || referenceCount < BigInt(1) || typeof budget.explicitlyShared !== "boolean" ? "invalid_budget" : null;
  return { name: campaign.name, status: campaign.status === "ENABLED" ? "ACTIVE" : campaign.status, dailyBudgetMinor: daily !== null ? String(daily) : null,
    budgetRef, budgetEditable: budgetReason === null, budgetReason, canEdit: ["ENABLED", "PAUSED"].includes(campaign.status) };
}

function validateLocal(target: CampaignTarget, change: CampaignChange, snapshot: CampaignSnapshot) {
  if (!snapshot.canEdit) fail("permission_required");
  if (change.kind === "status") { if (!["ACTIVE", "PAUSED"].includes(change.value)) fail("invalid_change"); return; }
  if (change.kind !== "daily_budget" || typeof change.value !== "string" || !/^[1-9]\d{0,18}$/.test(change.value)) fail("invalid_change");
  const amount = BigInt(change.value);
  if (amount > MAX_INT64 || (target.platform === "google" && amount * BigInt(10000) > MAX_INT64)) fail("invalid_change");
  if (!snapshot.budgetEditable || !snapshot.budgetRef) fail("budget_not_editable");
  if (target.platform === "meta" ? snapshot.budgetRef !== target.campaignId : !new RegExp(`^customers/${target.accountId}/campaignBudgets/\\d+$`).test(snapshot.budgetRef)) fail("target_mismatch");
}

// A failed write may already have reached the provider. Never retry it here.
async function mutation(url: string, init: RequestInit, fetcher: typeof fetch, validateOnly: boolean): Promise<Record<string, unknown>> {
  let response: Response;
  try { response = await fetcher(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(30_000) }); }
  catch { fail(validateOnly ? "provider_rejected" : "outcome_unknown"); }
  if (response.status >= 500) fail(validateOnly ? "provider_rejected" : "outcome_unknown");
  if (!response.ok) fail("provider_rejected");
  let data: unknown;
  try { data = await response.json(); } catch { fail(validateOnly ? "invalid_response" : "outcome_unknown"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(validateOnly ? "invalid_response" : "outcome_unknown");
  const result = asRecord(data);
  if (result.error) fail("provider_rejected");
  return result;
}
function googleMutation(target: CampaignTarget, change: CampaignChange, snapshot: CampaignSnapshot, validateOnly: boolean) {
  const status = change.kind === "status";
  const resourceName = status ? `customers/${target.accountId}/campaigns/${target.campaignId}` : snapshot.budgetRef!;
  return { resourceName, endpoint: status ? "campaigns:mutate" : "campaignBudgets:mutate", body: JSON.stringify({ operations: [{
    update: status ? { resourceName, status: change.value === "ACTIVE" ? "ENABLED" : "PAUSED" } : { resourceName, amountMicros: String(BigInt(change.value) * BigInt(10000)) },
    updateMask: status ? "status" : "amountMicros",
  }], validateOnly }) };
}
export async function validateCampaignChange(target: CampaignTarget, credentials: CampaignCredentials, change: CampaignChange, snapshot: CampaignSnapshot, fetcher: typeof fetch = fetch): Promise<void> {
  const { base, headers } = config(target, credentials); validateLocal(target, change, snapshot);
  if (target.platform === "meta") { if (!await metaPermission(base, headers, fetcher)) fail("permission_required"); return; }
  const request = googleMutation(target, change, snapshot, true);
  await mutation(`${base}/${request.endpoint}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: request.body }, fetcher, true);
}
/** Caller must re-read/compare the snapshot and atomically claim the confirmed proposal before invoking. */
export async function applyCampaignChange(target: CampaignTarget, credentials: CampaignCredentials, change: CampaignChange, snapshot: CampaignSnapshot, fetcher: typeof fetch = fetch): Promise<void> {
  const { base, headers } = config(target, credentials); validateLocal(target, change, snapshot);
  if (target.platform === "meta") {
    const body = new URLSearchParams({ [change.kind === "status" ? "status" : "daily_budget"]: change.value });
    const result = await mutation(`${base}/${target.campaignId}`, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body }, fetcher, false);
    if (result.success !== true) fail("outcome_unknown");
    return;
  }
  const request = googleMutation(target, change, snapshot, false);
  const result = await mutation(`${base}/${request.endpoint}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: request.body }, fetcher, false);
  if (result.partialFailureError || !Array.isArray(result.results) || result.results.length !== 1 || asRecord(result.results[0]).resourceName !== request.resourceName) fail("outcome_unknown");
}
