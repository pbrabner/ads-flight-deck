import { z } from "zod";
import { fetchJson } from "./connectors/http";
import { asRecord } from "./connectors/types";
import { canLinkConnection } from "./validation";

export type MetaAccount = { id: string; name: string; currency: string; timezone: string };
const fields = "id,account_id,name,currency,timezone_name";
const accountSchema = z.object({
  id: z.string().regex(/^act_\d+$/), account_id: z.string().regex(/^\d+$/).optional(),
  name: z.string().trim().min(1).max(500), currency: z.string().regex(/^[A-Z]{3}$/), timezone_name: z.string().min(1).max(120),
});
function metadata(value: unknown): MetaAccount {
  const parsed = accountSchema.safeParse(value);
  if (!parsed.success) throw new Error("invalid_response");
  const row = parsed.data, id = row.id.slice(4);
  if (row.account_id && row.account_id !== id) throw new Error("invalid_response");
  return { id, name: row.name, currency: row.currency, timezone: row.timezone_name };
}
function apiVersion() {
  const value = process.env.META_API_VERSION || "v25.0";
  if (!/^v\d+\.\d+$/.test(value)) throw new Error("invalid_configuration");
  return value;
}
function pageUrl(input: string, version: string): string {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("invalid_pagination"); }
  if (url.origin !== "https://graph.facebook.com" || url.username || url.password || !new RegExp(`^/${version.replace(".", "\\.")}/(?:me|\\d+)/adaccounts/?$`).test(url.pathname)) throw new Error("invalid_pagination");
  url.searchParams.delete("access_token");
  url.hash = "";
  return url.toString();
}
export async function listMetaAccounts(token: string, fetcher: typeof fetch = fetch): Promise<MetaAccount[]> {
  const version = apiVersion(), rows = new Map<string, MetaAccount>(), seen = new Set<string>();
  let next: string | undefined = `https://graph.facebook.com/${version}/me/adaccounts?${new URLSearchParams({ fields, limit: "100" })}`;
  while (next) {
    const url = pageUrl(next, version);
    if (seen.has(url) || seen.size >= 100) throw new Error("pagination_limit");
    seen.add(url);
    const result = asRecord(await fetchJson(url, { headers: { Authorization: `Bearer ${token}` } }, fetcher));
    if (!Array.isArray(result.data)) throw new Error("invalid_response");
    for (const raw of result.data) { const account = metadata(raw); rows.set(account.id, account); }
    const following = asRecord(result.paging).next;
    if (following != null && typeof following !== "string") throw new Error("invalid_pagination");
    next = following as string | undefined;
  }
  return [...rows.values()];
}
export async function getMetaAccount(token: string, id: string, fetcher: typeof fetch = fetch): Promise<MetaAccount> {
  if (!/^\d{1,40}$/.test(id)) throw new Error("invalid");
  const result = metadata(await fetchJson(`https://graph.facebook.com/${apiVersion()}/act_${id}?${new URLSearchParams({ fields })}`, { headers: { Authorization: `Bearer ${token}` } }, fetcher));
  if (result.id !== id) throw new Error("invalid_response");
  return result;
}
export function metaAccountIssue(account: Pick<MetaAccount, "currency" | "timezone">): string | null {
  return account.currency !== "BRL" || account.timezone !== "America/Sao_Paulo" ? "Disponível apenas para contas em BRL e no fuso America/Sao_Paulo." : null;
}
export function assertMetaAccountLink(connection: { platform: string; owner_client_id: string | null }, clientId: string, account: MetaAccount, existing: { client_id: string } | null): void {
  if (!canLinkConnection(connection, { platform: "meta", client_id: clientId })) throw new Error("connection_mismatch");
  if (existing && existing.client_id !== clientId) throw new Error("account_other_client");
  if (metaAccountIssue(account)) throw new Error("unsupported_currency_or_timezone");
}
