import type { PlatformFilter } from "./platform";
import { addDays, todayIn, type Period } from "./period";
import { totals, type EntityMetrics, type DailyMetrics } from "./metrics";
import { matchesStatus, summarizeResults, type CampaignStatus } from "./results";
const campaigns = [
  ["Fibra 600 Mega • Captação", "meta", 1.4],
  ["Internet fibra • Pesquisa", "google", 1.1],
  ["Conecte sua casa • WhatsApp", "meta", 0.92],
  ["Marca • Pesquisa", "google", 0.55],
  ["Volte a se conectar • Remarketing", "meta", 0.42],
  ["Cobertura regional • Performance Max", "google", 0.7],
] as const;
export const demoClient = { id: "demo", slug: "demo", name: "Horizonte Fibra" };
export function demoSnapshot(period: Period, level = "campaign", parent: string | null = null, now = new Date(), status: CampaignStatus = "all", selectedPlatform: PlatformFilter = "all"): { entities: EntityMetrics[]; series: DailyMetrics[]; previous: DailyMetrics[] } {
  const today = todayIn(now);
  const resultType = (index: number) => campaigns[index][1] === "google" ? "google:conversions" : index === 2 ? "actions:onsite_conversion.messaging_conversation_started_7d" : "actions:lead";
  const statusOf = (index: number) => index < 4 ? "ACTIVE" : "PAUSED";
  const daily = campaigns.map(([, , weight], index) => Array.from({ length: 90 }, (_, i) => {
    const wave = 1 + Math.sin(i * 0.8 + index) * 0.23;
    const leads = Math.round((8 + i * 0.04) * weight * wave);
    return { date: addDays(today, i - 89), spend: Math.round((70 + i * 0.4) * weight * wave * 100) / 100,
      impressions: Math.round(3200 * weight * wave), clicks: Math.round(91 * weight * wave),
      leads, results: [{ type: resultType(index), value: leads }], result_complete: true };
  }));
  const rowsIn = (rows: DailyMetrics[], from: string, to: string) => rows.filter(r => r.date >= from && r.date <= to);
  const selected = daily.filter((_, index) => matchesStatus(statusOf(index), status) && (selectedPlatform === "all" || campaigns[index][1] === selectedPlatform));
  const combined = (selected[0] ?? []).map((r, i) => {
    const rows = selected.map(rows => rows[i]);
    return { date: r.date, ...totals(rows), results: summarizeResults(rows).groups.map(({ type, value }) => ({ type, value })), result_complete: true };
  });
  const entities: EntityMetrics[] = [];
  campaigns.forEach(([name, campaignPlatform], i) => {
    if (selectedPlatform !== "all" && campaignPlatform !== selectedPlatform) return;
    const platform = campaignPlatform;
    const id = `campaign-${i + 1}`;
    const sum = totals(rowsIn(daily[i], period.from, period.to));
    const metadata = { objective: platform === "google" ? i === 5 ? "PERFORMANCE_MAX" : "SEARCH" : i === 2 ? "OUTCOME_ENGAGEMENT" : "OUTCOME_LEADS", result_complete: true };
    const measured = (value: number) => rowsIn(daily[i], period.from, period.to).length ? [{ type: resultType(i), value }] : null;
    if (level === "campaign" && matchesStatus(statusOf(i), status)) entities.push({ ...sum, ...metadata, results: measured(sum.leads), id, name, platform, level: "campaign", parent_id: null, status: statusOf(i) });
    for (let j = 1; j <= 2; j++) {
      const adsetId = `${id}-set-${j}`;
      const half = totals([{ ...sum, spend: sum.spend / 2, impressions: sum.impressions / 2, clicks: sum.clicks / 2, leads: sum.leads / 2 }]);
      if (level === "adset" && parent === id) entities.push({ ...half, ...metadata, results: measured(half.leads), id: adsetId, name: j === 1 ? "Público local • Região central" : "Público local • Bairros", platform, level: "adset", parent_id: id, status: "ACTIVE" });
      for (let k = 1; k <= 2; k++) if (level === "ad" && parent === adsetId) {
        const quarter = totals([{ ...half, spend: half.spend / 2, impressions: half.impressions / 2, clicks: half.clicks / 2, leads: half.leads / 2 }]);
        entities.push({ ...quarter, ...metadata, results: measured(quarter.leads), id: `${adsetId}-ad-${k}`, name: k === 1 ? "Sua casa mais conectada" : "Velocidade para ir além", platform, level: "ad", parent_id: adsetId, status: "ACTIVE" });
      }
    }
  });
  return {
    entities: entities.sort((a, b) => b.spend - a.spend),
    series: rowsIn(combined, period.from, period.to),
    previous: rowsIn(combined, period.prevFrom, period.prevTo),
  };
}
