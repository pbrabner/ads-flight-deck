import { platformFilter } from "@/lib/platform";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { Shell } from "@/components/shell";
import { MetricsTable } from "@/components/metrics-table";
import { PeriodSelect } from "@/components/period-select";
import { getClient, getSnapshot } from "@/lib/queries";
import { periodFromParams, periodQuery, type SearchParams } from "@/lib/period";
import { campaignStatus } from "@/lib/results";

export default async function Detail({ params, searchParams }: { params: Promise<{ slug: string; level: string; id: string }>; searchParams: Promise<SearchParams> }) {
  const { slug, level, id } = await params;
  if (!["campaign", "adset"].includes(level) || !z.uuid().safeParse(id).success) notFound();
  const { client, profile, db } = await getClient(slug);
  const { data: entity, error } = await db.from("entities").select("id,name,parent_id,ad_accounts!inner(client_id)").eq("id", id).eq("level", level).eq("ad_accounts.client_id", client.id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar os detalhes.");
  if (!entity) notFound();
  const query = await searchParams, period = periodFromParams(query), status = campaignStatus(query.status), platform = platformFilter(query.platform);
  const data = await getSnapshot(client.id, period, level === "campaign" ? "adset" : "ad", id, status, platform);
  const back = level === "campaign" ? `/c/${slug}` : `/c/${slug}/campaign/${entity.parent_id}`;
  return <Shell name={client.name} slug={slug} admin={profile.role === "admin"}><Link className="back-link" href={`${back}?${periodQuery(period)}&status=${status}&platform=${platform}`}><ArrowLeft size={16} />Voltar</Link><div className="page-heading"><div><h1>{entity.name}</h1><p>{level === "campaign" ? "Conjuntos desta campanha" : "Anúncios deste conjunto"}</p>{level === "campaign" && profile.role === "admin" && <Link className="text-link" href={`/admin/campaigns/${id}`}>Editar status ou orçamento da campanha</Link>}</div><PeriodSelect period={period} status={status} platform={platform} /></div><section className="panel"><MetricsTable rows={data.entities} basePath={`/c/${slug}`} period={period} status={status} platform={platform} /></section></Shell>;
}
