import type { ResultMetrics } from "./results";
export type Metrics = { spend: number; impressions: number; clicks: number; leads: number };
export type Totals = Metrics & { ctr: number | null; cpc: number | null; cpl: number | null };
export type DailyMetrics = Metrics & ResultMetrics & { date: string };
export type EntityMetrics = Totals & ResultMetrics & { id: string; name: string; platform: "meta" | "google"; status: string; level: "campaign" | "adset" | "ad"; parent_id: string | null; objective?: string | null };
export function ratio(a: number, b: number): number | null { return b > 0 ? a / b : null; }
export function delta(a: number, b: number): number | null { return b > 0 ? (a - b) / b * 100 : null; }
export function totals(rows: Metrics[]): Totals {
  const sum = rows.reduce((a, b) => ({
    spend: a.spend + Number(b.spend), impressions: a.impressions + Number(b.impressions),
    clicks: a.clicks + Number(b.clicks), leads: a.leads + Number(b.leads),
  }), { spend: 0, impressions: 0, clicks: 0, leads: 0 });
  return { ...sum, ctr: sum.impressions ? sum.clicks / sum.impressions * 100 : null, cpc: ratio(sum.spend, sum.clicks), cpl: ratio(sum.spend, sum.leads) };
}
