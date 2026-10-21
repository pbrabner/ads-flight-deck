import "server-only";
import { z } from "zod";
import { requireAdmin } from "./auth";
import { adminDb } from "./supabase/admin";
import { canLinkConnection } from "./validation";
import { refreshAccessToken } from "./connectors/google";
import { readCampaign, validateCampaignChange, applyCampaignChange, type CampaignSnapshot, type CampaignChange, type CampaignTarget } from "./campaign-provider";
import { budgetMinor, executeCampaignProposal, matchesChange } from "./campaign-workflow";

export type CampaignChangeRecord = {
  id: string; entity_id: string; actor_id: string; target: CampaignTarget & { connectionId: string }; before_state: CampaignSnapshot; change: CampaignChange;
  status: string; error: string | null; after_state: CampaignSnapshot | null; created_at: string; expires_at: string; started_at: string | null; finished_at: string | null;
};
export const changeMessages: Record<string, string> = {
  permission_required: "Esta conexão ainda não tem permissão para editar a campanha.",
  invalid_budget: "Informe um orçamento maior que zero, com até duas casas decimais e sem separador de milhar.",
  invalid_change: "Confira o status ou orçamento informado.",
  no_change: "O valor informado já é o valor atual da campanha.",
  budget_not_editable: "O orçamento desta campanha não pode ser alterado por esta tela.",
  state_changed: "A campanha mudou desde a prévia. Consulte os valores atuais e gere uma nova proposta.",
  proposal_expired: "A proposta expirou. Gere uma nova prévia com os valores atuais.",
  proposal_unavailable: "A proposta já foi usada, cancelada, expirou ou existe uma execução pendente nesta campanha.",
  proposal_invalid: "Esta proposta não está disponível para sua confirmação.",
  provider_rejected: "A plataforma recusou a solicitação. Confira as permissões e as regras da conta antes de tentar novamente.",
  outcome_unknown: "A resposta não confirmou a alteração. Confira o estado atual antes de qualquer nova tentativa.",
  audit_failed: "Não foi possível registrar o resultado da execução. A alteração pode ter sido aplicada; reconfira o estado da campanha.",
  connection_mismatch: "A conexão da conta mudou. Gere uma nova proposta usando a conexão atual.",
  token_invalid: "A autorização expirou ou foi revogada. Conecte a plataforma novamente.",
  unsupported_currency_or_timezone: "A conta precisa usar BRL e o fuso America/Sao_Paulo.",
  operation_failed: "Não foi possível concluir. Atualize a página e confira a conexão.",
};
export const budgetMessages: Record<string, string> = {
  shared_budget: "Orçamento compartilhado com outras campanhas. Altere-o no Google Ads.",
  non_daily_budget: "Esta campanha não usa orçamento diário.",
  lifetime_budget: "Esta campanha usa orçamento vitalício.",
  adset_budget: "O orçamento é definido nos conjuntos de anúncios.",
  invalid_budget: "O orçamento retornado não permite edição nesta tela.",
};
export const changeStatusLabels: Record<string, string> = { draft: "Aguardando confirmação", executing: "Execução em andamento", succeeded: "Aplicada e conferida", failed: "Não aplicada", unknown: "Resultado a conferir", verified: "Estado atual confirmado", cancelled: "Cancelada" };

async function context(entityId: string) {
  await requireAdmin();
  if (!z.uuid().safeParse(entityId).success) throw new Error("invalid_change");
  const db = adminDb();
  const entityResult = await db.from("entities").select("id,name,external_id,ad_account_id,platform,level").eq("id", entityId).eq("level", "campaign").single();
  if (entityResult.error || !entityResult.data) throw new Error("campaign_not_found");
  const entity = entityResult.data;
  const accountResult = await db.from("ad_accounts").select("id,client_id,connection_id,platform,external_id,login_customer_id").eq("id", entity.ad_account_id).single();
  if (accountResult.error || !accountResult.data) throw new Error("operation_failed");
  const account = accountResult.data;
  const [connectionResult, clientResult] = await Promise.all([
    db.from("connections").select("id,platform,owner_client_id,access_token,refresh_token").eq("id", account.connection_id).single(),
    db.from("clients").select("id,name,slug").eq("id", account.client_id).single(),
  ]);
  const connection = connectionResult.data, client = clientResult.data;
  if (connectionResult.error || clientResult.error || !connection || !client || entity.platform !== account.platform || !canLinkConnection(connection, account)) throw new Error("connection_mismatch");
  const target: CampaignTarget = { platform: account.platform as "meta" | "google", accountId: account.external_id, campaignId: entity.external_id, ...(account.login_customer_id ? { loginCustomerId: account.login_customer_id } : {}) };
  const accessToken = target.platform === "google" ? connection.refresh_token ? await refreshAccessToken(connection.refresh_token) : "" : connection.access_token;
  if (!accessToken) throw new Error("token_invalid");
  return { db, entity, account, connection, client, target, credentials: { accessToken }, savedTarget: { ...target, connectionId: connection.id } };
}
export async function campaignEditor(entityId: string, proposalId?: string) {
  const ctx = await context(entityId);
  const [recent, pending, selected] = await Promise.all([
    ctx.db.from("campaign_changes").select("*").eq("entity_id", entityId).order("created_at", { ascending: false }).limit(30),
    ctx.db.from("campaign_changes").select("*").eq("entity_id", entityId).in("status", ["executing", "unknown"]),
    z.uuid().safeParse(proposalId).success ? ctx.db.from("campaign_changes").select("*").eq("entity_id", entityId).eq("id", proposalId!) : Promise.resolve({ data: [], error: null }),
  ]);
  if (recent.error || pending.error || selected.error) throw new Error("operation_failed");
  const history = [...new Map([...(recent.data || []), ...(pending.data || []), ...(selected.data || [])].map(row => [row.id, row as CampaignChangeRecord])).values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  let snapshot: CampaignSnapshot | null = null, readError = "";
  try { snapshot = await readCampaign(ctx.target, ctx.credentials); } catch { readError = "Não foi possível consultar a campanha na plataforma. Confira sua autorização e tente novamente."; }
  // Only this explicit DTO reaches the page; credentials never leave this module.
  return { checkedAt: Date.now(), entity: ctx.entity, client: ctx.client, platform: ctx.target.platform, ownerClientId: ctx.connection.owner_client_id as string | null, snapshot, readError, history };
}
export async function prepareCampaignChange(entityId: string, kind: string, input: string): Promise<string> {
  const { user } = await requireAdmin();
  const ctx = await context(entityId);
  const change: CampaignChange = kind === "status" ? { kind, value: z.enum(["ACTIVE", "PAUSED"]).parse(input) } : kind === "daily_budget" ? { kind, value: budgetMinor(input) } : (() => { throw new Error("invalid_change"); })();
  const pending = await ctx.db.from("campaign_changes").select("id").eq("entity_id", entityId).in("status", ["executing", "unknown"]).limit(1);
  if (pending.error) throw new Error("operation_failed");
  if (pending.data?.length) throw new Error("proposal_unavailable");
  const snapshot = await readCampaign(ctx.target, ctx.credentials);
  if (matchesChange(snapshot, change)) throw new Error("no_change");
  await validateCampaignChange(ctx.target, ctx.credentials, change, snapshot);
  const result = await ctx.db.from("campaign_changes").insert({ entity_id: entityId, actor_id: user.id, target: ctx.savedTarget, before_state: snapshot, change,
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }).select("id").single();
  if (result.error || !result.data) throw new Error("operation_failed");
  return result.data.id;
}
export async function confirmCampaignChange(entityId: string, proposalId: string) {
  const { user } = await requireAdmin();
  if (!z.uuid().safeParse(proposalId).success) throw new Error("proposal_invalid");
  const ctx = await context(entityId);
  const result = await ctx.db.from("campaign_changes").select("*").eq("id", proposalId).eq("entity_id", entityId).eq("actor_id", user.id).single();
  if (result.error || !result.data) throw new Error("proposal_invalid");
  const proposal = result.data as CampaignChangeRecord;
  if (JSON.stringify(proposal.target, Object.keys(proposal.target).sort()) !== JSON.stringify(ctx.savedTarget, Object.keys(ctx.savedTarget).sort())) throw new Error("connection_mismatch");
  await executeCampaignProposal({ actorId: proposal.actor_id, expiresAt: proposal.expires_at, before: proposal.before_state, change: proposal.change }, user.id, {
    claim: async () => {
      const result = await ctx.db.rpc("claim_campaign_change", { p_id: proposalId, p_actor: user.id });
      if (result.error) throw new Error("operation_failed"); return result.data === true;
    },
    read: () => readCampaign(ctx.target, ctx.credentials),
    validate: snapshot => validateCampaignChange(ctx.target, ctx.credentials, proposal.change, snapshot),
    apply: snapshot => applyCampaignChange(ctx.target, ctx.credentials, proposal.change, snapshot),
    finish: async (status, error, after) => {
      const saved = await ctx.db.from("campaign_changes").update({ status, error, after_state: after ?? null, finished_at: new Date().toISOString() }).eq("id", proposalId).eq("status", "executing").select("id").single();
      if (saved.error || !saved.data) throw new Error("audit_failed");
      // Provider remains authoritative; the next sync refreshes all reporting metadata.
    },
  });
}
export async function cancelCampaignChange(entityId: string, proposalId: string) {
  const { user } = await requireAdmin();
  if (!z.uuid().safeParse(proposalId).success || !z.uuid().safeParse(entityId).success) throw new Error("proposal_invalid");
  const result = await adminDb().from("campaign_changes").update({ status: "cancelled", finished_at: new Date().toISOString() }).eq("id", proposalId).eq("entity_id", entityId).eq("actor_id", user.id).eq("status", "draft").select("id").single();
  if (result.error || !result.data) throw new Error("proposal_unavailable");
}
export async function verifyCampaignChange(entityId: string, proposalId: string) {
  const { user } = await requireAdmin();
  if (!z.uuid().safeParse(proposalId).success) throw new Error("proposal_invalid");
  const ctx = await context(entityId);
  const result = await ctx.db.from("campaign_changes").select("*").eq("id", proposalId).eq("entity_id", entityId).single();
  if (result.error || !result.data) throw new Error("proposal_invalid");
  const proposal = result.data as CampaignChangeRecord;
  const stale = proposal.status === "executing" && !!proposal.started_at && Date.parse(proposal.started_at) < Date.now() - 10 * 60_000;
  if (proposal.status !== "unknown" && !stale) throw new Error("proposal_unavailable");
  if (JSON.stringify(proposal.target, Object.keys(proposal.target).sort()) !== JSON.stringify(ctx.savedTarget, Object.keys(ctx.savedTarget).sort())) throw new Error("connection_mismatch");
  const snapshot = await readCampaign(ctx.target, ctx.credentials);
  if (proposal.change.kind === "daily_budget" && snapshot.budgetRef !== proposal.before_state.budgetRef) throw new Error("state_changed");
  if (!matchesChange(snapshot, proposal.change)) throw new Error("outcome_unknown");
  const saved = await ctx.db.from("campaign_changes").update({ status: "verified", after_state: snapshot, verified_by: user.id, finished_at: new Date().toISOString(), error: null }).eq("id", proposalId).eq("status", proposal.status).select("id").single();
  if (saved.error || !saved.data) throw new Error("audit_failed");
}
