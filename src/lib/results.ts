export type ResultEntry = { type: string; value: number };
export type ResultMetrics = { results?: ResultEntry[] | null; result_complete?: boolean };
export type CampaignStatus = "all" | "active" | "paused";
export function campaignStatus(value: unknown): CampaignStatus { return value === "active" || value === "paused" ? value : "all"; }
export function matchesStatus(status: string, filter: CampaignStatus) {
  return filter === "all" || (filter === "active" ? ["ACTIVE", "ENABLED"].includes(status) : status === "PAUSED");
}
const record = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
// Reach and other unique-person measures cannot be added across daily reports.
export function normalizeResults(input: unknown): ResultEntry[] | null {
  if (!Array.isArray(input) || !input.length) return null;
  const entries: ResultEntry[] = [], seen = new Set<string>();
  for (const item of input) {
    const row = record(item), type = row.indicator;
    if (typeof type !== "string" || !(type.startsWith("actions:") || ["impressions", "clicks", "inline_link_clicks", "profile_visit_view"].includes(type)) || seen.has(type)) return null;
    const values = Array.isArray(row.values) ? row.values.map(record) : [];
    const defaults = values.filter(v => Array.isArray(v.attribution_windows) && v.attribution_windows.includes("default"));
    const chosen = defaults.length === 1 ? defaults[0] : values.length === 1 ? values[0] : undefined;
    if (!chosen || chosen.value === "" || chosen.value == null || !["string", "number"].includes(typeof chosen.value)) return null;
    const value = Number(chosen.value);
    if (!Number.isFinite(value) || value < 0) return null;
    seen.add(type); entries.push({ type, value });
  }
  return entries;
}
export function summarizeResults(rows: (ResultMetrics & { spend: number })[]) {
  const complete = rows.length > 0 && rows.every(r => r.result_complete !== false && !!r.results?.length);
  const groups = new Map<string, { type: string; value: number; spend: number; cost: number | null }>();
  const ambiguous = new Set<string>();
  for (const row of rows) for (const result of row.results ?? []) {
    const group = groups.get(result.type) ?? { type: result.type, value: 0, spend: 0, cost: null };
    group.value += result.value;
    if (row.results?.length === 1) group.spend += Number(row.spend); else ambiguous.add(result.type);
    groups.set(result.type, group);
  }
  for (const group of groups.values()) group.cost = complete && !ambiguous.has(group.type) && group.value > 0 ? group.spend / group.value : null;
  return { groups: [...groups.values()].sort((a,b) => a.type.localeCompare(b.type)), complete, single: complete && groups.size === 1 };
}
export function resultLabel(type: string): string {
  const labels: Record<string, string> = {
    "actions:lead": "Leads", "actions:onsite_conversion.lead_grouped": "Leads na Meta",
    "actions:offsite_conversion.fb_pixel_lead": "Leads no site",
    "actions:onsite_conversion.messaging_conversation_started_7d": "Conversas iniciadas",
    "actions:onsite_conversion.total_messaging_connection": "Contatos por mensagem",
    "actions:purchase": "Compras", "actions:offsite_conversion.fb_pixel_purchase": "Compras no site",
    "actions:link_click": "Cliques no link", "inline_link_clicks": "Cliques no link",
    "actions:landing_page_view": "Visualizações da página de destino",
    "actions:post_engagement": "Engajamentos", "actions:video_view": "Visualizações de vídeo",
    "actions:mobile_app_install": "Instalações do aplicativo", "impressions": "Impressões", "clicks": "Cliques",
    "google:conversions": "Conversões configuradas", "profile_visit_view": "Visitas ao perfil",
  };
  return labels[type] ?? type.replace(/^actions:/, "");
}
export function objectiveLabel(objective?: string | null): string {
  const labels: Record<string, string> = { OUTCOME_AWARENESS: "Reconhecimento", OUTCOME_TRAFFIC: "Tráfego", OUTCOME_ENGAGEMENT: "Engajamento", OUTCOME_LEADS: "Cadastros", OUTCOME_APP_PROMOTION: "Promoção do app", OUTCOME_SALES: "Vendas", LEAD_GENERATION: "Cadastros", MESSAGES: "Mensagens", CONVERSIONS: "Conversões", LINK_CLICKS: "Tráfego", REACH: "Alcance", BRAND_AWARENESS: "Reconhecimento", VIDEO_VIEWS: "Vídeo" };
  const channels: Record<string, string> = { SEARCH: "Pesquisa", DISPLAY: "Display", SHOPPING: "Shopping", VIDEO: "Vídeo", PERFORMANCE_MAX: "Performance Max", DEMAND_GEN: "Geração de demanda" };
  return objective ? labels[objective] ?? channels[objective] ?? objective : "Não informado";
}
