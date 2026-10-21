import Link from "next/link";
import { AccountWorkspace } from "./account-workspace";
import { RemoveConnection } from "./remove-connection";
import { requireAdmin } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createClient, createConnection, createAccount, linkUser, syncNow, replaceToken, setAccountActive } from "./actions";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
function ClientSelect({ clients, optional = false }: { clients: { id: string; name: string }[]; optional?: boolean }) {
  return <select name={optional ? "owner_client_id" : "client_id"} required={!optional}><option value="">{optional ? "Agência — compartilhada" : "Selecione um cliente"}</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
}
const errorMessages: Record<string, string> = {
  invalid: "Confira os campos preenchidos.", duplicate: "Este cadastro já existe.",
  connection_mismatch: "A conexão precisa pertencer à mesma plataforma e estar disponível para o cliente.",
  connection_in_use: "Esta conexão ainda tem contas vinculadas. Transfira os vínculos para uma conexão válida antes de removê-la. O histórico foi preservado.",
  user_not_found: "Crie o usuário no serviço de autenticação antes de vinculá-lo.",
  self_role: "Você não pode remover seu próprio acesso de administrador.",
  sync_failed: "A sincronização falhou. Consulte o status da conta abaixo.",
  operation_failed: "Não foi possível concluir. Confira a configuração do ambiente e tente novamente.",
};
const successMessages: Record<string, string> = {
  saved: "Cadastro salvo.", synced: "Sincronização concluída.", account_synced: "Conta cadastrada e histórico sincronizado.",
  account_saved_sync_failed: "Conta cadastrada. O histórico ainda precisa ser sincronizado; confira o erro abaixo.",
  connected: "Conexão autorizada e cadastrada.",
  connection_removed: "Conexão removida do Ads Flight Deck. Seus anúncios e o histórico foram preservados.",
};
export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; success?: string; client_id?: string }> }) {
  const { db } = await requireAdmin();
  const params = await searchParams;
  const results = await Promise.all([
    db.from("clients").select("id,name,slug").order("name"),
    db.from("connections_public").select("*").order("created_at", { ascending: false }),
    db.from("ad_accounts").select("id,external_id,platform,client_id,connection_id,active").order("created_at", { ascending: false }),
    db.from("profiles").select("user_id,email,role,client_id").order("email"),
    db.from("sync_runs").select("ad_account_id,status,started_at,error,rows").order("started_at", { ascending: false }).limit(500),
  ]);
  if (results.some(r => r.error)) throw new Error("Não foi possível carregar a administração.");
  const clients = results[0].data || [], connections = results[1].data || [], accounts = results[2].data || [], profiles = results[3].data || [], runs = results[4].data || [];
  return <Shell name="Sua agência" admin section="admin"><div className="page-heading"><div><h1>Administração</h1><p>Conecte suas contas e organize o acesso de cada cliente.</p></div></div>
    {(params.error || params.success) && <div role="status" className={`form-message ${params.error ? "error" : ""}`}>{params.error ? errorMessages[params.error] || "Não foi possível concluir a autorização. Confira a configuração e tente novamente." : successMessages[params.success!] || "Operação concluída."}</div>}
    {!process.env.SUPABASE_SERVICE_ROLE_KEY && <div className="form-message">O ambiente ainda precisa da chave de serviço para salvar cadastros e sincronizar.</div>}
    <AccountWorkspace clients={clients} connections={connections} accounts={accounts} runs={runs} selectedId={params.client_id} />
    <details className="admin-settings" id="admin-settings" open={!clients.length}><summary>Cadastros e opções avançadas <span>Clientes, usuários e configuração manual</span></summary><div className="admin-grid">
      <section className="panel admin-panel"><h2>Clientes</h2><p>Cada cliente tem um painel e acesso aos próprios resultados.</p><ul className="admin-list">{clients.map(c => <li key={c.id}><span>{c.name}<small>/{c.slug}</small></span><Link href={`/c/${c.slug}`}>Abrir painel</Link></li>)}</ul>
        <form action={createClient} className="stack-form"><label>Nome do cliente<Input name="name" required maxLength={120} placeholder="Ex.: Horizonte Fibra" /></label><label>Endereço do painel<Input name="slug" required maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="horizonte-fibra" /></label><SubmitButton>Adicionar cliente</SubmitButton></form>
      </section>
      <section className="panel admin-panel"><h2>Conexões</h2><p>Conecte a plataforma com sua conta e escolha quais contas de anúncios vincular.</p>
        <div className="oauth-links"><a href="/api/oauth/meta/start">Conectar Meta</a><a href="/api/oauth/google/start">Conectar Google</a></div>
        <ul className="admin-list">{connections.map(c => <li key={c.id}><div><strong>{c.label}</strong><small>{c.platform === "meta" ? "Meta Ads" : "Google Ads"} · {c.owner_client_id ? clients.find(x => x.id === c.owner_client_id)?.name : "Agência"}</small><Link href={c.platform === "meta" ? `/admin/connections/${c.id}` : `/admin/google-connections/${c.id}`} className="text-link">Selecionar contas</Link><details className="mt-3"><summary className="text-link">Avançado: atualizar token manualmente</summary><form className="stack-form mt-3" action={replaceToken}><input type="hidden" name="id" value={c.id} /><label>Novo token<Input name="token" type="password" minLength={10} required autoComplete="off" /></label><SubmitButton>Atualizar token</SubmitButton></form></details><RemoveConnection connection={c} accounts={accounts} clients={clients} clientId={params.client_id} /></div></li>)}</ul>
        <details className="mt-6"><summary className="text-link">Avançado: cadastrar token manualmente</summary><p>Prefira conectar pela plataforma. Tokens manuais podem expirar e exigir manutenção.</p><form action={createConnection} className="stack-form"><label>Nome da conexão<Input name="label" required maxLength={120} placeholder="Conta da agência" /></label><label>Plataforma<select name="platform"><option value="meta">Meta Ads</option><option value="google">Google Ads</option></select></label><label>Disponível para<ClientSelect clients={clients} optional /></label><label>Token de acesso Meta ou refresh token Google<Input type="password" name="token" required minLength={10} autoComplete="off" /></label><SubmitButton>Salvar conexão</SubmitButton></form></details>
      </section>
      <section className="panel admin-panel"><h2>Contas de anúncios</h2><p>Contas em BRL e horário de Brasília. Use Selecionar contas na conexão Meta ou Google acima. O vínculo importa os últimos 90 dias.</p>
        <ul className="admin-list">{accounts.map(a => {
          const run = runs.find(r => r.ad_account_id === a.id);
          return <li key={a.id}><div><strong>{clients.find(c => c.id === a.client_id)?.name} · {a.external_id}</strong><small>{a.platform === "meta" ? "Meta Ads" : "Google Ads"} · {a.active ? "Sync ativa" : "Sync desativada"} · {run ? `${run.status === "ok" ? "Sincronizado" : run.status === "running" ? "Em andamento" : "Falha"} — ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(run.started_at))}` : "Aguardando primeira sincronização"}</small>{run?.error && <small className="change-bad">{run.error}</small>}<div className="flex flex-wrap gap-3 mt-3">{(["recent", "backfill"] as const).map(mode => <form key={mode} action={syncNow}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="mode" value={mode} /><SubmitButton pendingText="Sincronizando…">{mode === "recent" ? "Sync agora" : "Reprocessar 90 dias"}</SubmitButton></form>)}<form action={setAccountActive}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="active" value={String(!a.active)} /><SubmitButton>{a.active ? "Desativar sincronização" : "Ativar sincronização"}</SubmitButton></form></div></div></li>;
        })}</ul>
        <details className="mt-6"><summary className="text-link">Avançado: cadastrar conta por ID (Meta / Google)</summary><p>Use apenas se precisar configurar uma conta manualmente. Para Meta, a seleção após OAuth valida o acesso automaticamente.</p><form action={createAccount} className="stack-form"><label>Cliente<ClientSelect clients={clients} /></label><label>Conexão<select name="connection_id" required defaultValue=""><option value="">Selecione uma conexão</option>{connections.map(c => <option key={c.id} value={c.id}>{c.label} ({c.platform})</option>)}</select></label><label>Plataforma<select name="platform"><option value="meta">Meta Ads</option><option value="google">Google Ads</option></select></label><label>ID da conta<Input name="external_id" required placeholder="1234567890" /></label><label>Ações que contam como lead<Input name="lead_actions" placeholder="Meta: lead; Google: nome da conversão" /><small className="muted">Separe por vírgulas. Vazio no Google conta todas as conversões.</small></label><SubmitButton pendingText="Cadastrando e importando…">Adicionar conta</SubmitButton></form></details>
      </section>
      <section className="panel admin-panel"><h2>Usuários e acesso</h2><p>Crie o usuário no Supabase Auth e vincule o e-mail ao cliente aqui.</p>
        <ul className="admin-list">{profiles.map(p => <li key={p.user_id}><span>{p.email}<small>{p.role === "admin" ? "Administrador" : clients.find(c => c.id === p.client_id)?.name}</small></span></li>)}</ul>
        <form action={linkUser} className="stack-form"><label>E-mail<Input type="email" name="email" required /></label><label>Papel<select name="role"><option value="client">Cliente</option><option value="admin">Administrador</option></select></label><label>Cliente<select name="client_id" defaultValue=""><option value="">Sem cliente (administrador)</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><SubmitButton>Vincular usuário</SubmitButton></form>
        {!!clients.length && <details className="mt-6"><summary className="text-link">Autorizar conexão própria de um cliente</summary><ul className="admin-list mt-3">{clients.map(c => <li key={c.id}><span>{c.name}</span><span className="flex gap-3"><a href={`/api/oauth/meta/start?owner=${c.id}`}>Meta</a><a href={`/api/oauth/google/start?owner=${c.id}`}>Google</a></span></li>)}</ul></details>}
      </section>
    </div></details>
  </Shell>;
}
