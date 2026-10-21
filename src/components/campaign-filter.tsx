"use client";
import type { PlatformFilter } from "@/lib/platform";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { periodQuery, type Period } from "@/lib/period";
import type { CampaignStatus } from "@/lib/results";

export function CampaignFilter({ period, status, platform = "all" }: { period: Period; status: CampaignStatus; platform?: PlatformFilter }) {
  const router = useRouter(), pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return <div className="campaign-filter"><label htmlFor="campaign-status">Campanhas</label><select id="campaign-status" value={status} disabled={pending} onChange={event => {
    const params = new URLSearchParams(periodQuery(period));
    params.set("status", event.target.value);
    params.set("platform", platform);
    startTransition(() => router.push(`${pathname}?${params}`));
  }}><option value="all">Todas</option><option value="active">Ativas</option><option value="paused">Pausadas</option></select>{pending && <LoaderCircle size={16} className="animate-spin" aria-label="Filtrando campanhas" />}</div>;
}
