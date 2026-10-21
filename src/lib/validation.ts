import { z } from "zod";
export const platformSchema = z.enum(["meta", "google"]);
export const connectionRemovalSchema = z.object({ id: z.uuid(), confirmation: z.literal("remove") });
export const clientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});
export const profileSchema = z.object({
  email: z.email().max(254), role: z.enum(["admin", "client"]), client_id: z.union([z.uuid(), z.literal("")]),
}).refine(v => v.role !== "client" || !!v.client_id, "Cliente obrigatório.");
export const connectionSchema = z.object({
  platform: platformSchema, label: z.string().trim().min(1).max(120),
  token: z.string().trim().min(10).max(8192),
  owner_client_id: z.union([z.uuid(), z.literal("")]),
});
export const accountSchema = z.object({
  platform: platformSchema, external_id: z.string().trim().regex(/^(act_)?[0-9-]{1,40}$/),
  client_id: z.uuid(), connection_id: z.uuid(),
  lead_actions: z.string().max(2000).default(""),
});
export function normalizeAccountId(platform: string, id: string): string {
  return platform === "meta" ? id.trim().replace(/^act_/, "") : id.trim().replaceAll("-", "");
}
export function canLinkConnection(c: { platform: string; owner_client_id: string | null }, a: { platform: string; client_id: string }): boolean {
  return c.platform === a.platform && (!c.owner_client_id || c.owner_client_id === a.client_id);
}
export function safeReturnPath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !/[\r\n]/.test(path) ? path : "/";
}
