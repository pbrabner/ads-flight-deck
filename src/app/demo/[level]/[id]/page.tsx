import { platformFilter } from "@/lib/platform";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { MetricsTable } from "@/components/metrics-table";
import { PeriodSelect } from "@/components/period-select";
import { demoClient, demoSnapshot } from "@/lib/demo";
import { periodFromParams, periodQuery, type SearchParams } from "@/lib/period";
import { campaignStatus } from "@/lib/results";
export default async function DemoDetail({ params, searchParams }: { params: Promise<{ level: string; id: string }>; searchParams: Promise<SearchParams> }) {
  const { level, id } = await params;
  if (!["campaign", "adset"].includes(level)) notFound();
  const query = await searchParams, period = periodFromParams(query), status = campaignStatus(query.status), platform = platformFilter(query.platform);
  const data = demoSnapshot(period, level === "campaign" ? "adset" : "ad", id, new Date(), status, platform);
  if (!data.entities.length) notFound();
  const back = level === "campaign" ? "/demo" : `/demo/campaign/${id.split("-set-")[0]}`;
  return <Shell name={demoClient.name} demo><Link className="back-link" href={`${back}?${periodQuery(period)}&status=${status}&platform=${platform}`}><ArrowLeft size={16} />Voltar</Link><div className="page-heading"><div><h1>{level === "campaign" ? "Conjuntos" : "Anúncios"}</h1><p>Detalhamento com dados fictícios da demonstração.</p></div><PeriodSelect period={period} status={status} platform={platform} /></div><section className="panel"><MetricsTable rows={data.entities} basePath="/demo" period={period} status={status} platform={platform} /></section></Shell>;
}
