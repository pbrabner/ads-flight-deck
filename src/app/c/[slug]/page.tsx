import { platformFilter, loadPlatformReports } from "@/lib/platform";
import { Dashboard } from "@/components/dashboard";
import { Shell } from "@/components/shell";
import { getClient, getSnapshot } from "@/lib/queries";
import { periodFromParams, type SearchParams } from "@/lib/period";
import { campaignStatus } from "@/lib/results";
import { getPlatformFreshness } from "@/lib/freshness-query";
export default async function ClientDashboard({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> }) {
  const { slug } = await params;
  const { client, profile } = await getClient(slug);
  const query = await searchParams, period = periodFromParams(query), status = campaignStatus(query.status), platform = platformFilter(query.platform);
  const reports = await loadPlatformReports(platform, async selected => {
    const [snapshot, freshness] = await Promise.all([
      getSnapshot(client.id, period, "campaign", null, status, selected), getPlatformFreshness(client.id, selected),
    ]);
    return { ...snapshot, freshness };
  });
  return <Shell name={client.name} slug={slug} admin={profile.role === "admin"}><Dashboard reports={reports} period={period} status={status} platform={platform} basePath={`/c/${slug}`} manageHref={profile.role === "admin" ? `/admin?client_id=${client.id}` : undefined} /></Shell>;
}
