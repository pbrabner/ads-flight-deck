import { z } from "zod";
import { fetchJson } from "./connectors/http";
import { googleHeaders } from "./connectors/google";
import { asRecord, type Raw } from "./connectors/types";
import { canLinkConnection } from "./validation";

export type GoogleAccount = { id: string; name: string; currency: string; timezone: string; manager?: boolean; loginCustomerId?: string };
export type GoogleAccountDiscovery = { accounts: GoogleAccount[]; warnings: string[] };
const idSchema = z.string().regex(/^\d{1,40}$/);
const customerSchema = z.object({
  id: idSchema, descriptiveName: z.string().max(500).optional(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/), timeZone: z.string().min(1).max(120), manager: z.boolean().optional(),
});
function metadata(value: unknown, loginCustomerId?: string): GoogleAccount {
  const parsed = customerSchema.safeParse(value);
  if (!parsed.success) throw new Error("invalid_response");
  const row = parsed.data;
  return { id: row.id, name: row.descriptiveName?.trim() || row.id, currency: row.currencyCode, timezone: row.timeZone, manager: row.manager ?? false,
    ...(loginCustomerId ? { loginCustomerId } : {}) };
}
function baseUrl(): string {
  const version = process.env.GOOGLE_ADS_API_VERSION || "v26";
  if (!/^v\d+$/.test(version)) throw new Error("invalid_configuration");
  return `https://googleads.googleapis.com/${version}`;
}
async function query(token: string, id: string, gaql: string, loginCustomerId: string | undefined, fetcher: typeof fetch): Promise<Raw[]> {
  if (!idSchema.safeParse(id).success || (loginCustomerId !== undefined && !idSchema.safeParse(loginCustomerId).success)) throw new Error("invalid");
  const data = await fetchJson(`${baseUrl()}/customers/${id}/googleAds:searchStream`, {
    method: "POST", headers: googleHeaders({ accessToken: token, loginCustomerId }), body: JSON.stringify({ query: gaql }),
  }, fetcher);
  if (!Array.isArray(data)) throw new Error("invalid_response");
  return data.flatMap(chunk => {
    const results = asRecord(chunk).results;
    if (results === undefined) return [];
    if (!Array.isArray(results)) throw new Error("invalid_response");
    return results.map(asRecord);
  });
}
export async function getGoogleAccount(token: string, id: string, loginCustomerId?: string, fetcher: typeof fetch = fetch): Promise<GoogleAccount> {
  const rows = await query(token, id, "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1", loginCustomerId, fetcher);
  if (rows.length !== 1) throw new Error("invalid_response");
  const account = metadata(rows[0].customer, loginCustomerId);
  if (account.id !== id) throw new Error("invalid_response");
  return account;
}
export async function listGoogleAccounts(token: string, fetcher: typeof fetch = fetch): Promise<GoogleAccountDiscovery> {
  const raw = await fetchJson(`${baseUrl()}/customers:listAccessibleCustomers`, { headers: googleHeaders({ accessToken: token }) }, fetcher);
  const parsed = z.object({ resourceNames: z.array(z.string().regex(/^customers\/\d{1,40}$/)).default([]) }).safeParse(raw);
  if (!parsed.success) throw new Error("invalid_response");
  const accounts = new Map<string, GoogleAccount>(), warnings = new Set<string>();
  const managers: { id: string; loginCustomerId: string; depth: number }[] = [], visited = new Set<string>();
  let requests = 0;
  const limit = () => { warnings.add("discovery_limit"); };
  const failed = (cause: unknown) => {
    if (cause instanceof Error && cause.message === "token_invalid") throw cause;
    if (cause instanceof Error && cause.message === "google_production_access_required") { warnings.add(cause.message); return; }
    warnings.add("account_discovery_failed");
  };
  for (const resource of new Set(parsed.data.resourceNames)) {
    if (requests >= 100) { limit(); break; }
    requests++;
    const id = resource.slice("customers/".length);
    try {
      const account = await getGoogleAccount(token, id, undefined, fetcher);
      accounts.set(id, account);
      if (account.manager) managers.push({ id, loginCustomerId: id, depth: 0 });
    } catch (cause) { failed(cause); }
  }
  while (managers.length) {
    const manager = managers.shift()!;
    const route = `${manager.loginCustomerId}:${manager.id}`;
    if (visited.has(route)) continue;
    if (requests >= 100 || accounts.size >= 10_000 || manager.depth >= 10) { limit(); continue; }
    requests++; visited.add(route);
    try {
      const rows = await query(token, manager.id, "SELECT customer_client.id, customer_client.client_customer, customer_client.level, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager FROM customer_client WHERE customer_client.level <= 1 AND customer_client.status = 'ENABLED'", manager.loginCustomerId, fetcher);
      for (const row of rows) {
        if (accounts.size >= 10_000) { limit(); break; }
        const client = asRecord(row.customerClient);
        const account = metadata(client, manager.loginCustomerId);
        const level = client.level ?? "0";
        if (!["0", "1", 0, 1].includes(level as string | number) || client.clientCustomer !== `customers/${account.id}`) throw new Error("invalid_response");
        if (!accounts.has(account.id)) accounts.set(account.id, account);
        if (account.manager && account.id !== manager.id) managers.push({ id: account.id, loginCustomerId: manager.loginCustomerId, depth: manager.depth + 1 });
      }
    } catch (cause) { failed(cause); }
  }
  return { accounts: [...accounts.values()], warnings: [...warnings] };
}
export function googleAccountIssue(account: Pick<GoogleAccount, "currency" | "timezone" | "manager">): string | null {
  if (account.manager) return "Conta de administrador (MCC). Selecione uma conta de anúncios abaixo dela.";
  return account.currency !== "BRL" || account.timezone !== "America/Sao_Paulo" ? "Disponível apenas para contas em BRL e no fuso America/Sao_Paulo." : null;
}
export function assertGoogleAccountLink(connection: { platform: string; owner_client_id: string | null }, clientId: string, account: GoogleAccount, existing: { client_id: string } | null): void {
  if (!canLinkConnection(connection, { platform: "google", client_id: clientId })) throw new Error("connection_mismatch");
  if (existing && existing.client_id !== clientId) throw new Error("account_other_client");
  if (googleAccountIssue(account)) throw new Error("unsupported_account");
}
