import Link from "next/link";
import { ConnectionContext } from "@/components/connection-context";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { listMetaAccounts, metaAccountIssue, type MetaAccount } from "@/lib/meta-accounts";
import { Shell } from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
import { linkMetaAccount } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const messages: Record<string, string> = {
  invalid: "Selecione um cliente e uma conta disponíveis.",
  connection_mismatch: "Esta conexão pertence a outro cliente.",
  token_invalid: "A autorização expirou ou foi revogada. Conecte a Meta novamente.",
  account_other_client: "Esta conta já pertence a outro cliente e não pode ser transferida por aqui.",
  account_already_linked: "Esta conta acabou de ser vinculada. Atualize a página para conferir o cadastro.",
  unsupported_currency_or_timezone: "Esta conta precisa usar BRL e o fuso America/Sao_Paulo.",
  operation_failed: "Não foi possível vincular a conta. Confira a autorização e tente novamente.",
};
export default async function SelectMetaAccounts({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ client_id?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params, query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = adminDb();
  const connection = await db.from("connections").select("id,label,platform,owner_client_id,access_token").eq("id", id).single();
  if (connection.error || !connection.data || connection.data.platform !== "meta") notFound();
  const owner = connection.data.owner_client_id;
  const [clientResult, existingResult] = await Promise.all([
    owner ? db.from("clients").select("id,name").eq("id", owner) : db.from("clients").select("id,name").order("name"),
    db.from("ad_accounts").select("external_id,client_id,active").eq("platform", "meta"),
  ]);
  if (clientResult.error || existingResult.error) throw new Error("Não foi possível carregar os cadastros.");
  const clients = clientResult.data || [], existing = existingResult.data || [];
  const selected = clients.find(c => c.id === (query.client_id || owner));
  let accounts: MetaAccount[] = [], loadError = "";
  if (selected) {
    try {
      if (!connection.data.access_token) throw new Error("token_invalid");
      accounts = await listMetaAccounts(connection.data.access_token);
    } catch (cause) {
      loadError = cause instanceof Error && cause.message === "token_invalid" ? messages.token_invalid : "Não foi possível consultar suas contas na Meta. Confira as permissões da conexão e tente novamente.";
    }
  }
  return <Shell name="Sua agência" admin section="admin">
    <div className="page-heading"><div><Link href="/admin" className="text-link">Voltar à administração</Link><h1>Selecionar contas Meta</h1><p>{connection.data.label} · Escolha o cliente e a conta autorizada na Meta.</p></div></div>
    {query.error && <div role="alert" className="form-message error">{messages[query.error] || messages.operation_failed}</div>}
    <ConnectionContext client={selected} platform="Meta Ads" />
    <details className="panel admin-panel client-selection" open={!selected}><summary>{selected ? `Cliente selecionado: ${selected.name}` : "Escolher cliente"}</summary>
      <h2>1. Escolha o cliente</h2>
      {!clients.length ? <p>Cadastre um cliente na administração para continuar.</p> : <form method="get" className="stack-form">
        <label>Cliente<select name="client_id" required defaultValue={selected?.id || ""}><option value="">Selecione um cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <SubmitButton pendingText="Consultando…">Consultar contas disponíveis</SubmitButton>
      </form>}
    </details>
    {selected && <section className="panel admin-panel mt-6"><h2>Escolha a conta Meta Ads de {selected.name}</h2><p>Confira nome e ID antes de vincular. A importação inclui os últimos 90 dias; aceita contas em reais e horário de Brasília.</p>
      {loadError ? <div role="alert" className="form-message error">{loadError}<div className="oauth-links"><a href={`/api/oauth/meta/start${owner ? `?owner=${owner}` : ""}`}>Conectar Meta novamente</a></div></div> : !accounts.length ? <p>Nenhuma conta de anúncios foi disponibilizada nesta autorização. Confira seu acesso na Meta e autorize novamente.</p> : <ul className="admin-list">{accounts.map(account => {
        const linked = existing.find(a => a.external_id === account.id);
        const issue = metaAccountIssue(account) || (linked && linked.client_id !== selected.id ? "Já vinculada a outro cliente." : null);
        return <li key={account.id}><div><strong>{account.name}</strong><small>ID {account.id} · {account.currency} · {account.timezone}</small>
          {linked && linked.client_id === selected.id && <small>{linked.active ? "Já vinculada a este cliente. Você pode atualizar a autorização." : "Sincronização desativada. Vincular novamente reativa a conta."}</small>}
          {issue && <small>{issue}</small>}
          {!issue && <details className="link-confirmation"><summary>{linked ? "Revisar esta conexão" : "Selecionar esta conta"}</summary><p>Confirmar <strong>{account.name}</strong> (ID {account.id}) para <strong>{selected.name}</strong> na Meta Ads e importar os últimos 90 dias. Seus anúncios não serão alterados.</p><form action={linkMetaAccount} className="mt-3"><input type="hidden" name="connection_id" value={id} /><input type="hidden" name="client_id" value={selected.id} /><input type="hidden" name="external_id" value={account.id} /><SubmitButton pendingText="Vinculando e importando…">{linked ? "Confirmar atualização e importar" : "Confirmar vínculo e importar"}</SubmitButton></form></details>}
        </div></li>;
      })}</ul>}
    </section>}
  </Shell>;
}
