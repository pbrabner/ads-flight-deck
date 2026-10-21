import { platformFilter, loadPlatformReports } from "@/lib/platform";
import { Shell } from "@/components/shell";
import { Dashboard } from "@/components/dashboard";
import { demoClient, demoSnapshot } from "@/lib/demo";
import { periodFromParams, type SearchParams } from "@/lib/period";
import { campaignStatus } from "@/lib/results";
export const dynamic = "force-dynamic";
export default async function Demo({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams, period = periodFromParams(query), status = campaignStatus(query.status), platform = platformFilter(query.platform);
  const reports = await loadPlatformReports(platform, selected => demoSnapshot(period, "campaign", null, new Date(), status, selected));
  return <Shell name={demoClient.name} demo><Dashboard period={period} status={status} platform={platform} reports={reports} basePath="/demo" demo /></Shell>;
}
