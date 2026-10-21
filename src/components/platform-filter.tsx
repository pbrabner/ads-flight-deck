"use client";
import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { periodQuery, type Period } from "@/lib/period";
import { platformLabels, type PlatformFilter as Platform } from "@/lib/platform";
import type { CampaignStatus } from "@/lib/results";

export function PlatformFilter({ period, status, platform }: { period: Period; status: CampaignStatus; platform: Platform }) {
  const router = useRouter(), pathname = usePathname();
  const [pending, startTransition] = useTransition();
  return <div className="campaign-filter"><label htmlFor="report-platform">Plataforma</label><select id="report-platform" value={platform} disabled={pending} onChange={event => {
    const params = new URLSearchParams(periodQuery(period));
    params.set("status", status);
    params.set("platform", event.target.value);
    startTransition(() => router.push(`${pathname}?${params}`));
  }}>{Object.entries(platformLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{pending && <LoaderCircle size={16} className="animate-spin" aria-label="Filtrando plataforma" />}</div>;
}
