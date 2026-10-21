import type { ResultEntry } from "../results";
export type Platform = "meta" | "google";
export type Level = "campaign" | "adset" | "ad";
export type Raw = Record<string, unknown>;
export type Entity = { level: Level; externalId: string; parentExternalId?: string; name: string; status: string; objective?: string; raw: Raw };
export type DailyMetric = { level: Level; externalId: string; date: string; impressions: number; clicks: number; spend: number; leads: number; conversions: number; conversionValue: number; reach?: number; results?: ResultEntry[] | null; raw: Raw };
export type AccountRef = { externalId: string; leadActions: string[] };
export type Token = { accessToken: string; refreshToken?: string; loginCustomerId?: string };
export type SyncResult = { entities: Entity[]; metrics: DailyMetric[] };
export interface Connector { sync(acct: AccountRef, token: Token, from: string, to: string): Promise<SyncResult> }
export const asRecord = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {};
export const numeric = (value: unknown): number => {
  if (value == null || value === "") return 0;
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error("invalid_metric");
  return result;
};
