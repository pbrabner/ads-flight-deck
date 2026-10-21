import { platformCatalog, type PlatformFilter } from "@/lib/platform";
import Link from "next/link";
import { ChevronRight, BarChart3 } from "lucide-react";
import { count, money, pct } from "@/lib/format";
import type { EntityMetrics } from "@/lib/metrics";
import { periodQuery, type Period } from "@/lib/period";
import { objectiveLabel, resultLabel, summarizeResults, type CampaignStatus } from "@/lib/results";

export function MetricsTable({ rows, basePath, period, status = "all", platform = "all" }: { rows: EntityMetrics[]; basePath: string; period: Period; status?: CampaignStatus; platform?: PlatformFilter }) {
  if (!rows.length) return <div className="empty-state"><BarChart3 /><h3>Sem dados para os filtros selecionados</h3><p>Ajuste a plataforma, o status ou o período, ou sincronize uma conta para acompanhar os resultados.</p></div>;
  return <div className="table-scroll" role="region" aria-label="Resultados de mídia, tabela com rolagem horizontal" tabIndex={0}><table className="metrics-table"><caption className="sr-only">Resultados por campanha, conjunto ou anúncio</caption>
    <thead><tr><th>Nome / objetivo</th><th>Plataforma</th><th>Status</th><th>Investimento</th><th>Resultados</th><th>Custo / resultado</th><th>Impressões</th><th>Cliques</th><th>CTR</th><th>CPC</th></tr></thead>
    <tbody>{rows.map(row => { const summary = summarizeResults([row]); return <tr key={row.id}>
      <td>{row.level === "ad" ? <strong>{row.name}</strong> : <Link href={`${basePath}/${row.level === "campaign" ? "campaign" : "adset"}/${row.id}?${periodQuery(period)}&status=${status}&platform=${platform}`}>{row.name}<ChevronRight size={15} /></Link>}<small className="metric-description">{platformCatalog[row.platform].objectivePrefix}{objectiveLabel(row.objective)}</small></td>
      <td><span className={`platform platform-${row.platform}`}><span>{platformCatalog[row.platform].mark}</span>{platformCatalog[row.platform].label}</span></td>
      <td><span className={`status-label ${["ACTIVE", "ENABLED"].includes(row.status) ? "active" : ""}`}><span />{["ACTIVE", "ENABLED"].includes(row.status) ? "Ativo" : row.status === "PAUSED" ? "Pausado" : row.status}</span></td>
      <td>{money(row.spend)}</td><td className="result-cell">{summary.groups.length ? summary.groups.map(group => <div key={group.type}><strong>{count(group.value)}</strong><small className="metric-description">{resultLabel(group.type)}</small></div>) : <><span>—</span><small className="metric-description">Não disponível</small></>}{summary.groups.length > 0 && !summary.complete && <small className="metric-description">Dados parciais</small>}</td><td>{money(summary.single ? summary.groups[0].cost : null)}</td><td>{count(row.impressions)}</td><td>{count(row.clicks)}</td><td>{pct(row.ctr)}</td><td>{money(row.cpc)}</td>
    </tr>; })}</tbody>
  </table></div>;
}
