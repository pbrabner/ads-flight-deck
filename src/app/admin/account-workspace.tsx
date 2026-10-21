import Link from "next/link";
import { availablePlatforms, platformCatalog } from "@/lib/platform";
import { ArrowRight, BarChart3, CheckCircle2, CircleAlert, Clock3, Link2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { syncNow, setAccountActive } from "./actions";
import { RemoveConnection } from "./remove-connection";

type Client = { id: string; name: string; slug: string };
type Connection = { id: string; label: string; platform: string; owner_client_id: string | null };
type Account = { id: string; external_id: string; platform: string; client_id: string; connection_id: string; active: boolean };
type Run = { ad_account_id: string; status: string; started_at: string; error: string | null };

export function AccountWorkspace({ clients, connections, accounts, runs, selectedId }: {
  clients: Client[]; connections: Connection[]; accounts: Account[]; runs: Run[]; selectedId?: string;
}) {
  const selected = clients.find(c => c.id === selectedId);
  return <section className="account-workspace" aria-label="Conectar contas por cliente">
    <div className="client-choice"><div><h2>De qual cliente vamos cuidar?</h2><p>Escolha o cliente para conectar plataformas e acompanhar as contas dele.</p></div>
      {clients.length ? <form method="get" className="client-choice-form"><label htmlFor="workspace-client">Cliente</label><select id="workspace-client" name="client_id" defaultValue={selected?.id || ""} required><option value="">Selecione um cliente</option>{clients.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select><SubmitButton>Gerenciar contas</SubmitButton></form> : <p>Comece cadastrando um cliente em <a className="text-link" href="#admin-settings">Cadastros e opções avançadas</a>.</p>}
    </div>
    {!selected ? <div className="connection-start"><Link2 size={28} /><h3>Um cliente, suas contas, cada plataforma no lugar certo.</h3><p>Após selecionar o cliente, escolha uma plataforma disponível. Você autoriza o acesso, escolhe a conta e confirma a importação.</p></div> : <>
      <div className="client-context"><div><h2>Contas de {selected.name}</h2><p>Acompanhe investimento e resultados no dashboard do cliente.</p></div><Link className="dashboard-action" href={`/c/${selected.slug}`}><BarChart3 size={20} aria-hidden="true" />Abrir dashboard<ArrowRight size={18} aria-hidden="true" /></Link></div>
      <ol className="connection-steps" aria-label="Etapas para conectar uma conta"><li>Cliente selecionado</li><li>Autorizar plataforma</li><li>Escolher conta</li><li>Confirmar importação</li></ol>
      <div className="connection-platforms">{availablePlatforms.map(platform => {
        const config = platformCatalog[platform];
        const { label } = config;
        const linked = accounts.filter(a => a.client_id === selected.id && a.platform === platform);
        const available = connections.filter(c => c.platform === platform && (!c.owner_client_id || c.owner_client_id === selected.id));
        return <section key={platform} className={`connection-platform connection-${platform}`} aria-label={`Contas ${label}`}>
          <header><h3>{label}</h3><span>{linked.length ? `${linked.length} ${linked.length === 1 ? "conta vinculada" : "contas vinculadas"}` : "Nenhuma conta vinculada"}</span></header>
          <p className="connection-description">{config.connectionDescription}</p>
          <a className="connect-action" href={`${config.oauthPath}?owner=${selected.id}`}><Link2 size={20} aria-hidden="true" /><span>Conectar {label}</span><ArrowRight size={18} aria-hidden="true" /></a>
          <p className="connection-help">Clique para entrar na plataforma e autorizar o acesso. Use um usuário com acesso à conta de anúncios de {selected.name}; depois, escolha a conta a importar.</p>
          {!!available.length && <details className="existing-authorizations"><summary>Gerenciar conexões salvas ({available.length})</summary><ul>{available.map(c => <li key={c.id}><div className="authorization-entry"><div className="authorization-heading"><span>{c.label}<small>{c.owner_client_id ? "Disponível para este cliente" : "Autorização compartilhada da agência"}</small></span><Link href={`${config.accountsPath}/${c.id}?client_id=${selected.id}`}>Escolher conta<ArrowRight size={14} /></Link></div><RemoveConnection connection={c} accounts={accounts} clients={clients} clientId={selected.id} /></div></li>)}</ul></details>}
          <ul className="connected-accounts">{linked.map(a => {
            const run = runs.find(r => r.ad_account_id === a.id);
            const failed = run?.status === "error", running = run?.status === "running";
            const status = !a.active ? "Atualização automática desativada" : running ? "Importação em andamento" : failed ? "Precisa de atenção" : run?.status === "ok" ? "Dados sincronizados" : "Aguardando primeira importação";
            const ready = a.active && run?.status === "ok";
            return <li key={a.id}><div className={`account-status ${failed ? "needs-attention" : ready ? "" : "muted"}`}>{failed ? <CircleAlert size={17} /> : ready ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}<strong>{status}</strong></div><p>Conta {a.external_id}</p>
              {run && <small>Última tentativa: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(run.started_at))}</small>}
              {failed && <p className="account-recovery">{run?.error === "token_invalid" ? "A autorização expirou ou foi revogada. Autorize novamente e selecione esta mesma conta." : "Não foi possível atualizar os dados. Tente novamente; se a falha continuar, confira a autorização da conta."}</p>}
              <div className="account-actions"><form action={syncNow}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="client_id" value={selected.id} /><input type="hidden" name="mode" value="recent" /><SubmitButton disabled={running} pendingText="Atualizando…">Atualizar dados</SubmitButton></form><Link href={`${config.accountsPath}/${a.connection_id}?client_id=${selected.id}`}>Revisar vínculo</Link></div>
              <details className="account-options"><summary>Opções da sincronização</summary><p>Alterar a sincronização não pausa nem ativa anúncios na plataforma.</p><div className="account-actions"><form action={syncNow}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="client_id" value={selected.id} /><input type="hidden" name="mode" value="backfill" /><SubmitButton disabled={running} pendingText="Importando…">Reimportar 90 dias</SubmitButton></form><form action={setAccountActive}><input type="hidden" name="id" value={a.id} /><input type="hidden" name="client_id" value={selected.id} /><input type="hidden" name="active" value={String(!a.active)} /><SubmitButton>{a.active ? "Desativar sincronização" : "Ativar sincronização"}</SubmitButton></form></div></details>
            </li>;
          })}</ul>
        </section>;
      })}</div>
    </>}
  </section>;
}
