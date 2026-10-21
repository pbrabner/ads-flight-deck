import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { campaignEditor, changeMessages, budgetMessages, changeStatusLabels } from "@/lib/campaign-management";
import type { CampaignChange, CampaignSnapshot } from "@/lib/campaign-provider";
import { Shell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { money } from "@/lib/format";
import { previewChange, confirmChange, cancelChange, verifyChange } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const statusLabel = (status: string) => status === "ACTIVE" ? "Ativa" : status === "PAUSED" ? "Pausada" : status;
const amount = (minor: string | null) => money(minor === null ? null : Number(minor) / 100);
const beforeValue = (snapshot: CampaignSnapshot, change: CampaignChange) => change.kind === "status" ? statusLabel(snapshot.status) : amount(snapshot.dailyBudgetMinor);
const afterValue = (change: CampaignChange) => change.kind === "status" ? statusLabel(change.value) : amount(change.value);
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));

export default async function CampaignEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ proposal?: string; error?: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params, query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  let data: Awaited<ReturnType<typeof campaignEditor>> | null = null;
  try { data = await campaignEditor(id, query.proposal); } catch { /* Render a recoverable state without exposing upstream errors. */ }
  if (!data) return <Shell name="Sua agência" admin section="admin"><Link className="back-link" href="/admin"><ArrowLeft size={16} />Voltar à administração</Link><div role="alert" className="form-message error">Não foi possível carregar esta campanha. Confira a conta e a autorização na administração.</div></Shell>;
  const { snapshot, history, client, platform } = data, provider = platform === "meta" ? "Meta Ads" : "Google Ads";
  const proposal = history.find(row => row.id === query.proposal);
  const blocked = history.some(row => ["executing", "unknown"].includes(row.status));
  const expired = proposal ? Date.parse(proposal.expires_at) <= data.checkedAt : false;
  const metaAuth = `/api/oauth/meta/start?mode=manage${data.ownerClientId ? `&owner=${data.ownerClientId}` : ""}`;
  return <Shell name={client.name} slug={client.slug} admin section="admin">
    <Link className="back-link" href={`/c/${client.slug}/campaign/${id}`}><ArrowLeft size={16} />Voltar à campanha</Link>
    <div className="page-heading"><div><h1>Editar campanha</h1><p>{snapshot?.name || data.entity.name} · {provider} · {client.name}</p></div></div>
    {query.error && <div role="alert" className="form-message error">{changeMessages[query.error] || changeMessages.operation_failed}</div>}
    {data.readError && <div role="alert" className="form-message error">{data.readError}</div>}
    {snapshot && !snapshot.canEdit && <div className="form-message">{platform === "meta" ? <>Para editar, autorize o gerenciamento e vincule novamente esta conta à nova conexão. <a className="text-link" href={metaAuth}>Autorizar gerenciamento Meta</a></> : "Esta campanha não está em um estado que permita edição. Confira também suas permissões no Google Ads."}</div>}
    {blocked && <div role="status" className="form-message">Existe uma execução em andamento ou com resultado a conferir. Novas alterações ficam bloqueadas até a conferência no histórico.</div>}
    {snapshot && <section className="panel admin-panel edit-current"><h2>Estado consultado na plataforma</h2><dl><div><dt>Status</dt><dd>{statusLabel(snapshot.status)}</dd></div><div><dt>Orçamento diário da campanha</dt><dd>{amount(snapshot.dailyBudgetMinor)}</dd></div></dl>{snapshot.budgetReason && <p>{budgetMessages[snapshot.budgetReason] || budgetMessages.invalid_budget}</p>}<p>O painel de resultados recebe o status atualizado na próxima sincronização.</p></section>}
    {proposal && <section className="panel admin-panel change-preview" aria-labelledby="preview-title"><h2 id="preview-title">Revisar alteração</h2><p>{changeStatusLabels[proposal.status] || proposal.status} · Criada em {date(proposal.created_at)}</p><div className="change-comparison"><div><span>{proposal.change.kind === "status" ? "Status anterior" : "Orçamento diário anterior"}</span><strong>{beforeValue(proposal.before_state, proposal.change)}</strong></div><div><span>Proposta</span><strong>{afterValue(proposal.change)}</strong></div></div>
      {proposal.error && <p role="status">{changeMessages[proposal.error] || changeMessages.operation_failed}</p>}
      {proposal.status === "draft" && <>{expired ? <p>Proposta expirada. Gere uma nova prévia.</p> : <><p>A proposta vale até {date(proposal.expires_at)}. Os valores serão consultados novamente antes de aplicar.</p><form action={confirmChange} className="stack-form mt-4"><input type="hidden" name="entity_id" value={id} /><input type="hidden" name="proposal_id" value={proposal.id} /><label className="confirmation-label"><input type="checkbox" name="confirmed" value="yes" required />Confirmo esta alteração em {provider} para a campanha acima.</label><SubmitButton disabled={blocked || !snapshot?.canEdit || proposal.actor_id !== user.id} pendingText="Aplicando e conferindo…">Confirmar alteração em {provider}</SubmitButton></form></>}
      {proposal.actor_id === user.id && <form action={cancelChange} className="mt-3"><input type="hidden" name="entity_id" value={id} /><input type="hidden" name="proposal_id" value={proposal.id} /><SubmitButton>Cancelar proposta</SubmitButton></form>}</>}
    </section>}
    {snapshot && <div className="admin-grid edit-forms"><section className="panel admin-panel"><h2>Status da campanha</h2><p>Pausar ou reativar a veiculação desta campanha.</p><form action={previewChange} className="stack-form"><input type="hidden" name="entity_id" value={id} /><input type="hidden" name="kind" value="status" /><label>Novo status<select name="value" defaultValue={snapshot.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} disabled={!snapshot.canEdit || blocked}><option value="PAUSED">Pausada</option><option value="ACTIVE">Ativa</option></select></label><SubmitButton disabled={!snapshot.canEdit || blocked} pendingText="Consultando e preparando…">Revisar mudança de status</SubmitButton></form></section>
      <section className="panel admin-panel"><h2>Orçamento diário</h2><p>Valor em reais. Disponível para orçamento diário próprio da campanha.</p><form action={previewChange} className="stack-form"><input type="hidden" name="entity_id" value={id} /><input type="hidden" name="kind" value="daily_budget" /><label>Novo orçamento diário (R$)<Input name="value" inputMode="decimal" placeholder="Ex.: 50,00" maxLength={13} required disabled={!snapshot.canEdit || !snapshot.budgetEditable || blocked} /></label><SubmitButton disabled={!snapshot.canEdit || !snapshot.budgetEditable || blocked} pendingText="Consultando e preparando…">Revisar mudança de orçamento</SubmitButton></form></section></div>}
    <section className="panel campaign-panel change-history"><header><div><h2>Histórico de alterações</h2><p>Propostas recentes, pendentes e a proposta selecionada.</p></div></header>{history.length ? <div className="table-scroll" role="region" aria-label="Histórico de alterações da campanha" tabIndex={0}><table className="results-summary"><thead><tr><th>Data</th><th>Alteração</th><th>Administrador</th><th>Situação</th><th>Conferência</th></tr></thead><tbody>{history.map(row => <tr key={row.id}><td>{date(row.created_at)}</td><td>{row.change.kind === "status" ? "Status" : "Orçamento diário"}<br />{beforeValue(row.before_state, row.change)} → {afterValue(row.change)}</td><td>{row.actor_id === user.id ? "Você" : "Outro administrador"}</td><td><Link href={`?proposal=${row.id}`}>{changeStatusLabels[row.status] || row.status}</Link>{row.error && <small className="metric-description">{changeMessages[row.error] || changeMessages.operation_failed}</small>}</td><td>{(row.status === "unknown" || (row.status === "executing" && row.started_at && Date.parse(row.started_at) < data.checkedAt - 10 * 60_000)) && <form action={verifyChange}><input type="hidden" name="entity_id" value={id} /><input type="hidden" name="proposal_id" value={row.id} /><SubmitButton pendingText="Conferindo…">Reconferir estado</SubmitButton></form>}</td></tr>)}</tbody></table></div> : <div className="empty-state"><p>Nenhuma alteração proposta nesta campanha.</p></div>}<footer>Uma resposta incerta não gera nova tentativa automática. “Estado atual confirmado” registra que a plataforma está no valor proposto, sem reaplicar a operação.</footer></section>
  </Shell>;
}
