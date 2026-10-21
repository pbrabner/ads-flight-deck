import Link from "next/link";
import { Clock3 } from "lucide-react";
import type { AccountFreshness, PlatformFreshness } from "@/lib/data-freshness";
import { shortDate } from "@/lib/format";

const labels: Record<AccountFreshness["state"], string> = {
  recent: "Coleta recente", stale: "Dados desatualizados", error: "Falha na última tentativa",
  running: "Atualização em andamento", interrupted: "Atualização não concluída",
  waiting: "Sem coleta concluída", disabled: "Sincronização desativada", unknown: "Status indisponível",
};
const timestamp = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo",
}).format(new Date(value));

export function DataFreshness({ data, manageHref }: { data: PlatformFreshness; manageHref?: string }) {
  const issues = data.accounts.filter(a => a.state !== "recent" || a.needsReconnection);
  return <aside className={`data-freshness ${data.unavailable || issues.length ? "needs-attention" : ""}`} aria-label="Atualização dos dados">
    <div className="freshness-heading"><Clock3 size={18} aria-hidden="true" /><strong>{data.unavailable ? "Não foi possível consultar a atualização" : !data.accounts.length ? "Nenhuma conta vinculada" : issues.length ? `${issues.length} ${issues.length === 1 ? "conta precisa de atenção" : "contas precisam de atenção"}` : "Coleta recente nas contas desta plataforma"}</strong>{manageHref && <Link href={manageHref}>Gerenciar contas</Link>}</div>
    {data.unavailable ? <p>As métricas continuam disponíveis, mas não foi possível confirmar quando foram coletadas. Tente atualizar a página.</p> : !data.accounts.length ? <p>Conecte uma conta desta plataforma para começar a acompanhar os resultados.</p> : <>
      <p>{issues.length ? "Os valores exibidos podem estar incompletos ou desatualizados. Confira a situação de cada conta." : "Consulte os horários e as janelas importadas abaixo. A atualização não acontece em tempo real."}</p>
      <details><summary>Ver atualização por conta ({data.accounts.length})</summary><ul>{data.accounts.map(account => <li key={account.id}>
        <div><strong>Conta {account.externalId}</strong><span className={account.state === "recent" ? "freshness-recent" : "freshness-warning"}>{labels[account.state]}</span></div>
        {account.collectedAt ? <p>Coleta da janela mais recente: <time dateTime={account.collectedAt}>{timestamp(account.collectedAt)}</time> (Brasília). Janela importada: {shortDate(account.from!)} a {shortDate(account.to!)}.</p> : <p>{account.state === "unknown" ? "Não foi possível consultar o histórico de atualização desta conta." : "Sem uma coleta concluída confirmada para esta conta."}</p>}
        {account.needsReconnection && <p>A autorização precisa ser revisada. {manageHref ? "Reconecte a conta na administração." : "Peça ao responsável pela conta para revisar a conexão."}</p>}
      </li>)}</ul></details>
      <p className="freshness-note">Coleta recente: concluída há até 36 horas, com janela que alcança pelo menos ontem. Isso não garante cobertura completa do período selecionado ou da comparação anterior.</p>
    </>}
  </aside>;
}
