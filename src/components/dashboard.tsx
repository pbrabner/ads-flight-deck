import { PlatformFilter } from "./platform-filter";
import { platformCatalog, platformLabels, type AvailablePlatform, type PlatformFilter as Platform } from "@/lib/platform";
import { ArrowDown, ArrowUp, FlaskConical, TrendingUp, UsersRound, ChevronDown } from "lucide-react";
import { totals, delta, type DailyMetrics, type EntityMetrics, type Totals } from "@/lib/metrics";
import { count, money, pct, shortDate } from "@/lib/format";
import type { Period } from "@/lib/period";
import { DailyChart } from "./daily-chart";
import { MetricsTable } from "./metrics-table";
import { PeriodSelect } from "./period-select";
import { CampaignFilter } from "./campaign-filter";
import { resultLabel, summarizeResults, type CampaignStatus } from "@/lib/results";

const kpis: { key: keyof Totals; label: string; format: (v: number | null) => string; better: "up" | "down" | "neutral" }[] = [
  { key: "spend", label: "Investimento", format: money, better: "neutral" },
  { key: "leads", label: "Leads gerados", format: count, better: "up" },
  { key: "cpl", label: "Custo por lead", format: money, better: "down" },
  { key: "impressions", label: "Impressões", format: count, better: "up" },
  { key: "clicks", label: "Cliques", format: count, better: "up" },
  { key: "ctr", label: "Taxa de cliques", format: pct, better: "up" },
  { key: "cpc", label: "Custo por clique", format: money, better: "down" },
];
export type PlatformReport = { platform: AvailablePlatform; series: DailyMetrics[]; previous: DailyMetrics[]; entities: EntityMetrics[] };

export function Dashboard({ period, reports, basePath, demo = false, status = "all", platform = "all" }: {
  period: Period; reports: PlatformReport[]; basePath: string; demo?: boolean; status?: CampaignStatus; platform?: Platform;
}) {
  return <>
    <div className="page-heading"><div><h1>Visão geral</h1><p>Entenda o desempenho de cada plataforma, separadamente.</p></div></div>
    <div className="analysis-toolbar"><div className="report-filters"><PlatformFilter period={period} status={status} platform={platform} /><CampaignFilter period={period} status={status} platform={platform} /><PeriodSelect key={`${period.range}-${period.from}-${period.to}`} period={period} status={status} platform={platform} /></div><p>Mesmo período, análises independentes. Resultados e custos não são combinados entre plataformas.</p></div>
    {demo && <div className="demo-notice"><FlaskConical size={18} /><span><strong>Explore o seu futuro painel.</strong> Esta demonstração usa dados fictícios de uma empresa de internet.</span></div>}
    {platform === "all" && <nav className="platform-jump" aria-label="Ir para análise da plataforma">{reports.map(report => <a key={report.platform} href={`#analysis-${report.platform}`}>{platformLabels[report.platform]}<ArrowDown size={14} /></a>)}</nav>}
    {reports.map(report => <PlatformAnalysis key={report.platform} {...report} period={period} basePath={basePath} status={status} view={platform} />)}
  </>;
}

function PlatformAnalysis({ period, series, previous, entities, basePath, status, platform, view }: PlatformReport & {
  period: Period; basePath: string; status: CampaignStatus; view: Platform;
}) {
  const current = totals(series), old = totals(previous);
  const summary = summarizeResults(entities.filter(e => e.spend !== 0 || e.impressions > 0 || e.clicks > 0 || e.results?.length));
  const oldSummary = summarizeResults(previous);
  const primary = summary.groups.length === 1 ? summary.groups[0] : null;
  const comparable = summary.single && oldSummary.single && primary?.type === oldSummary.groups[0]?.type;
  current.leads = summary.single ? primary!.value : 0;
  current.cpl = summary.single ? primary!.cost : null;
  old.leads = comparable ? oldSummary.groups[0].value : 0;
  old.cpl = comparable ? oldSummary.groups[0].cost : null;
  const resultSeries = series.map(row => ({ ...row, result: row.result_complete === false ? null : row.results?.find(r => r.type === primary?.type)?.value ?? null }));
  return <section className={`platform-analysis analysis-${platform}`} id={`analysis-${platform}`} aria-label={`Análise ${platformLabels[platform]}`}>
    <header className="platform-heading"><div><h2>{platformLabels[platform]}</h2><p>{platformCatalog[platform].analysisDescription}</p></div><span>{shortDate(period.from)} — {shortDate(period.to)}</span></header>
    {!entities.length && <p className="platform-empty">Nenhuma campanha desta plataforma para os filtros selecionados. Ajuste o status ou confira o vínculo e a sincronização da conta.</p>}
    <div className="kpi-grid">{kpis.map((kpi, index) => {
      const value = current[kpi.key], before = old[kpi.key];
      const change = value !== null && before !== null ? delta(value, before) : null;
      const good = change !== null && (kpi.better === "down" ? change < 0 : change > 0);
      const label = kpi.key === "leads" ? primary ? resultLabel(primary.type) : "Resultados" : kpi.key === "cpl" ? "Custo por resultado" : kpi.label;
      const display = kpi.key === "leads" ? primary ? count(primary.value) : summary.groups.length ? `${summary.groups.length} tipos` : "—" : kpi.format(value);
      return <article className={`kpi ${index < 3 ? "kpi-primary" : ""}`} key={kpi.key}><span className="kpi-label">{label}</span><strong className="kpi-value">{display}</strong>
        <div className="kpi-change">{(kpi.key === "leads" || kpi.key === "cpl") && !summary.single ? <span className="muted">{!summary.complete ? "Dados parciais ou indisponíveis" : "Veja cada tipo de resultado abaixo"}</span> : change === null ? <span className="muted">Sem base anterior</span> : <><span className={kpi.better === "neutral" || change === 0 ? "change-neutral" : good ? "change-good" : "change-bad"}>{change < 0 ? <ArrowDown size={12} /> : <ArrowUp size={12} />}{pct(Math.abs(change))}</span><span className="muted">vs. anterior</span></>}</div>
      </article>;
    })}</div>
    <div className="chart-grid">
      <section className="panel chart-panel"><header><div><span className="chart-icon"><TrendingUp size={18} /></span><h2>Investimento ao longo do tempo</h2></div><span className="chart-legend"><i />Investimento</span></header>{series.length ? <DailyChart data={series} metric="spend" /> : <div className="chart-empty">Sem investimento registrado no período.</div>}</section>
      <section className="panel chart-panel"><header><div><span className="chart-icon green"><UsersRound size={18} /></span><h2>{primary ? `${resultLabel(primary.type)} ao longo do tempo` : "Resultados por tipo"}</h2></div></header>{primary ? <DailyChart data={resultSeries} metric="result" resultName={resultLabel(primary.type)} /> : summary.groups.length ? <><table className="results-summary"><caption className="sr-only">Resultados separados por tipo</caption><thead><tr><th>Resultado</th><th>Quantidade</th><th>Custo / resultado</th></tr></thead><tbody>{summary.groups.map(group => <tr key={group.type}><td>{resultLabel(group.type)}</td><td>{count(group.value)}</td><td>{money(group.cost)}</td></tr>)}</tbody></table><p className="comparison-note">Cada tipo é medido separadamente. Conversas, leads e compras não são somados.</p></> : <div className="chart-empty">Sem resultados disponíveis no período.</div>}</section>
    </div>
    <details className="panel campaign-panel campaign-disclosure" open={view !== "all"}><summary><span>Campanhas {platformLabels[platform]}<small>Abra para investigar {platformCatalog[platform].detailHint}.</small></span><span className="campaign-disclosure-count">{entities.length} campanhas<ChevronDown size={18} /></span></summary><MetricsTable rows={entities} period={period} basePath={basePath} status={status} platform={view} /><footer>Selecione uma campanha para explorar os detalhes. “Não disponível” indica resultado ausente ou que não pode ser somado entre dias, como alcance.</footer></details>
    <p className="comparison-note">Variações apenas de {platformLabels[platform]}, comparando com {shortDate(period.prevFrom)} a {shortDate(period.prevTo)}. O status é o da última sincronização, nos dois períodos. {platformCatalog[platform].comparisonNote}</p>
  </section>;
}
