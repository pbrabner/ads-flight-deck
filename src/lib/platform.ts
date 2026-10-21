type PlatformPresentation = {
  label: string;
  mark: string;
  analysisDescription: string;
  connectionDescription: string;
  detailHint: string;
  objectivePrefix: string;
  comparisonNote: string;
} & ({ available: true; oauthPath: string; accountsPath: string } | { available: false });

// Enable a platform only after its connector, permissions and storage support exist.
export const platformCatalog = {
  meta: {
    available: true,
    label: "Meta Ads", mark: "∞",
    analysisDescription: "Resultados por campanha: conversas, cadastros, visitas e outras ações informadas pela Meta.",
    connectionDescription: "Campanhas e resultados de Facebook e Instagram.",
    detailHint: "objetivos, conjuntos e anúncios", objectivePrefix: "",
    comparisonNote: "Atribuição e resultados seguem o relatório da Meta; conversas não significam vendas confirmadas.",
    oauthPath: "/api/oauth/meta/start", accountsPath: "/admin/connections",
  },
  google: {
    available: true,
    label: "Google Ads", mark: "G",
    analysisDescription: "Conversões conforme a configuração da conta Google. Pesquisa, vídeo e outros canais aparecem nas campanhas.",
    connectionDescription: "Campanhas de pesquisa, YouTube e demais canais do Google Ads.",
    detailHint: "canais, grupos e anúncios", objectivePrefix: "Canal: ",
    comparisonNote: "Conversões podem representar ações diferentes; não equivalem necessariamente a leads ou vendas. Compare campanhas com metas compatíveis.",
    oauthPath: "/api/oauth/google/start", accountsPath: "/admin/google-connections",
  },
  tiktok: {
    available: false,
    label: "TikTok Ads", mark: "T",
    analysisDescription: "Resultados das campanhas TikTok, separados por objetivo e tipo de ação.",
    connectionDescription: "Campanhas e resultados do TikTok Ads.",
    detailHint: "objetivos, grupos e anúncios", objectivePrefix: "Objetivo: ",
    comparisonNote: "Resultados seguem as configurações de atribuição do TikTok. Visualizações, cliques e conversões são analisados separadamente.",
  },
  linkedin: {
    available: false,
    label: "LinkedIn Ads", mark: "in",
    analysisDescription: "Resultados das campanhas LinkedIn, separados por objetivo e tipo de ação.",
    connectionDescription: "Campanhas e resultados do LinkedIn Ads.",
    detailHint: "objetivos e anúncios", objectivePrefix: "Objetivo: ",
    comparisonNote: "Resultados seguem as configurações de atribuição do LinkedIn. Cadastros e outras conversões não confirmam vendas ou qualificação comercial.",
  },
} as const satisfies Record<string, PlatformPresentation>;

export type PlatformId = keyof typeof platformCatalog;
export type AvailablePlatform = { [K in PlatformId]: typeof platformCatalog[K]["available"] extends true ? K : never }[PlatformId];
export type PlatformFilter = "all" | AvailablePlatform;

export const availablePlatforms = (Object.keys(platformCatalog) as PlatformId[])
  .filter((id): id is AvailablePlatform => platformCatalog[id].available);

export function platformFilter(value: string | string[] | undefined): PlatformFilter {
  return availablePlatforms.find(id => id === value) ?? "all";
}

export const platformLabels = Object.fromEntries([
  ["all", "Todas, separadas"],
  ...availablePlatforms.map(id => [id, platformCatalog[id].label]),
]) as Record<PlatformFilter, string>;

export function reportPlatforms(platform: PlatformFilter): AvailablePlatform[] {
  return platform === "all" ? [...availablePlatforms] : [platform];
}

// Each call receives exactly one platform, including its previous-period series.
export async function loadPlatformReports<T extends object>(
  filter: PlatformFilter,
  load: (platform: AvailablePlatform) => T | Promise<T>,
): Promise<(T & { platform: AvailablePlatform })[]> {
  return Promise.all(reportPlatforms(filter).map(async platform => ({ ...await load(platform), platform })));
}
