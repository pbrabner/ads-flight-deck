import Link from "next/link";
import { ConnectionContext } from "@/components/connection-context";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { listGoogleAccounts, googleAccountIssue, type GoogleAccount } from "@/lib/google-accounts";
import { refreshAccessToken } from "@/lib/connectors/google";
import { Shell } from "@/components/shell";
import { SubmitButton } from "@/components/submit-button";
import { linkGoogleAccount } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const messages: Record<string, string> = {
  google_production_access_required: "O projeto Google Cloud está aprovado apenas para contas de teste. Solicite acesso Explorer à Google Ads API no mesmo projeto das credenciais OAuth para consultar contas reais. Depois da aprovação, consulte as contas novamente.",
  invalid: "Selecione um cliente e uma conta disponíveis.",
  connection_mismatch: "Esta conexão pertence a outro cliente.",
  token_invalid: "A autorização expirou ou foi revogada. Conecte o Google novamente.",
  account_other_client: "Esta conta já pertence a outro cliente e não pode ser transferida por aqui.",
  account_already_linked: "Esta conta acabou de ser vinculada. Atualize a página para conferir o cadastro.",
  unsupported_account: "Selecione uma conta de anúncios em BRL e no fuso America/Sao_Paulo. Contas MCC não são importadas.",
  operation_failed: "Não foi possível vincular a conta. Confira a autorização e tente novamente.",
};
export default async function SelectGoogleAccounts({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ client_id?: string; error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params, query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = adminDb();
  const connection = await db.from("connections").select("id,label,platform,owner_client_id,refresh_token").eq("id", id).single();
  if (connection.error || !connection.data || connection.data.platform !== "google") notFound();
  const owner = connection.data.owner_client_id;
  const [clientResult, existingResult] = await Promise.all([
    owner ? db.from("clients").select("id,name").eq("id", owner) : db.from("clients").select("id,name").order("name"),
    db.from("ad_accounts").select("external_id,client_id,active").eq("platform", "google"),
  ]);
  if (clientResult.error || existingResult.error) throw new Error("Não foi possível carregar os cadastros.");
  const clients = clientResult.data || [], existing = existingResult.data || [];
  const selected = clients.find(c => c.id === (query.client_id || owner));
  let accounts: GoogleAccount[] = [], loadError = "", warnings: string[] = [];
  if (selected) {
    try {
      if (!connection.data.refresh_token) throw new Error("token_invalid");
      const token = await refreshAccessToken(connection.data.refresh_token);
      ({ accounts, warnings } = await listGoogleAccounts(token));
    } catch (cause) {
      loadError = cause instanceof Error && ["token_invalid", "google_production_access_required"].includes(cause.message) ? messages[cause.message] : "Não foi possível consultar suas contas no Google Ads. Confira as permissões da conexão e o acesso à API no projeto Google Cloud.";
    }
  }
  const needsProductionAccess = warnings.includes("google_production_access_required") || loadError === messages.google_production_access_required;
  const otherWarnings = warnings.filter(warning => warning !== "google_production_access_required");
  return <Shell name="Sua agência" admin section="admin">
    <div className="page-heading"><div><Link href="/admin" className="text-link">Voltar à administração</Link><h1>Selecionar contas Google Ads</h1><p>{connection.data.label} · Escolha o cliente e a conta autorizada no Google.</p></div></div>
    {query.error && <div role="alert" className="form-message error">{messages[query.error] || messages.operation_failed}</div>}
    <ConnectionContext client={selected} platform="Google Ads" />
    <details className="panel admin-panel client-selection" open={!selected}><summary>{selected ? `Cliente selecionado: ${selected.name}` : "Escolher cliente"}</summary>
      <h2>1. Escolha o cliente</h2>
      {!clients.length ? <p>Cadastre um cliente na administração para continuar.</p> : <form method="get" className="stack-form">
        <label>Cliente<select name="client_id" required defaultValue={selected?.id || ""}><option value="">Selecione um cliente</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <SubmitButton pendingText="Consultando…">Consultar contas disponíveis</SubmitButton>
      </form>}
    </details>
    {selected && <section className="panel admin-panel mt-6"><h2>Escolha a conta Google Ads de {selected.name}</h2><p>Confira nome e ID antes de vincular. A importação inclui os últimos 90 dias; aceita contas em reais e horário de Brasília. Contas de administrador (MCC) agrupam as contas de anúncios acessíveis.</p>
      {needsProductionAccess && <div role="alert" className="form-message error">{messages.google_production_access_required}<div className="oauth-links"><a href="https://console.cloud.google.com/google/ads-apis/overview" target="_blank" rel="noopener noreferrer">Abrir acesso à Google Ads API</a></div></div>}
      {otherWarnings.length > 0 && <div role="alert" className="form-message error">A lista está incompleta: algumas contas não puderam ser consultadas{otherWarnings.includes("discovery_limit") ? " ou o limite de consulta foi atingido" : ""}. Você pode vincular as contas disponíveis e tentar consultar novamente.</div>}
      {loadError && !needsProductionAccess ? <div role="alert" className="form-message error">{loadError}<div className="oauth-links"><a href={`/api/oauth/google/start${owner ? `?owner=${owner}` : ""}`}>Conectar Google novamente</a></div></div> : !accounts.length ? !needsProductionAccess && <p>Nenhuma conta de anúncios foi disponibilizada nesta consulta. Confira seu acesso no Google Ads e autorize novamente.</p> : <ul className="admin-list">{accounts.map(account => {
        const linked = existing.find(a => a.external_id === account.id);
        const issue = googleAccountIssue(account) || (linked && linked.client_id !== selected.id ? "Já vinculada a outro cliente." : null);
        return <li key={account.id}><div><strong>{account.name}</strong><small>ID {account.id} · {account.currency} · {account.timezone}{account.loginCustomerId ? ` · via MCC ${account.loginCustomerId}` : " · Acesso direto"}</small>
          {linked && linked.client_id === selected.id && <small>{linked.active ? "Já vinculada a este cliente. Você pode atualizar a autorização." : "Sincronização desativada. Vincular novamente reativa a conta."}</small>}
          {issue && <small>{issue}</small>}
          {!issue && <details className="link-confirmation"><summary>{linked ? "Revisar esta conexão" : "Selecionar esta conta"}</summary><p>Confirmar <strong>{account.name}</strong> (ID {account.id}) para <strong>{selected.name}</strong> no Google Ads e importar os últimos 90 dias. Seus anúncios não serão alterados.</p><form action={linkGoogleAccount} className="mt-3"><input type="hidden" name="connection_id" value={id} /><input type="hidden" name="client_id" value={selected.id} /><input type="hidden" name="external_id" value={account.id} /><input type="hidden" name="login_customer_id" value={account.loginCustomerId || ""} /><SubmitButton pendingText="Vinculando e importando…">{linked ? "Confirmar atualização e importar" : "Confirmar vínculo e importar"}</SubmitButton></form></details>}
        </div></li>;
      })}</ul>}
    </section>}
  </Shell>;
}
