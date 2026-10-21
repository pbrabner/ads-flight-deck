"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { accountSchema, canLinkConnection, clientSchema, connectionSchema, connectionRemovalSchema, normalizeAccountId, profileSchema } from "@/lib/validation";
import { syncAll } from "@/lib/sync";
import { addDays, todayIn } from "@/lib/period";

async function finish(operation: () => Promise<string | void>, clientId?: FormDataEntryValue | null) {
  let message = "saved", error = "";
  try { message = (await operation()) || "saved"; }
  catch (cause) { error = cause instanceof Error && ["invalid", "duplicate", "connection_mismatch", "connection_in_use", "user_not_found", "self_role", "sync_failed", "no_account"].includes(cause.message) ? cause.message : "operation_failed"; }
  revalidatePath("/admin");
  const clientQuery = z.uuid().safeParse(clientId).success ? `&client_id=${clientId}` : "";
  redirect(`/admin?${error ? `error=${error}` : `success=${message}`}${clientQuery}`);
}
function checked(error: { code?: string } | null) { if (error) throw new Error(error.code === "23505" ? "duplicate" : "operation_failed"); }
function parse<T>(schema: z.ZodType<T>, form: FormData): T {
  const result = schema.safeParse(Object.fromEntries(form));
  if (!result.success) throw new Error("invalid");
  return result.data;
}
export async function createClient(form: FormData) {
  await requireAdmin();
  await finish(async () => { checked((await adminDb().from("clients").insert(parse(clientSchema, form))).error); });
}
export async function createConnection(form: FormData) {
  await requireAdmin();
  await finish(async () => {
    const data = parse(connectionSchema, form);
    checked((await adminDb().from("connections").insert({
      platform: data.platform, label: data.label, owner_client_id: data.owner_client_id || null,
      access_token: data.platform === "meta" ? data.token : null, refresh_token: data.platform === "google" ? data.token : null,
    })).error);
  });
}
export async function replaceToken(form: FormData) {
  await requireAdmin();
  await finish(async () => {
    const data = parse(z.object({ id: z.uuid(), token: z.string().trim().min(10).max(8192) }), form);
    const db = adminDb();
    const found = await db.from("connections").select("platform").eq("id", data.id).single();
    checked(found.error);
    if (!found.data) throw new Error("invalid");
    checked((await db.from("connections").update({
      [found.data.platform === "meta" ? "access_token" : "refresh_token"]: data.token,
      expires_at: null,
    }).eq("id", data.id)).error);
  });
}
export async function removeConnection(form: FormData) {
  await requireAdmin();
  await finish(async () => {
    const { id } = parse(connectionRemovalSchema, form);
    // The restrictive FK checks all clients and prevents concurrent links from losing history.
    const result = await adminDb().from("connections").delete().eq("id", id).select("id").single();
    if (result.error?.code === "23503") throw new Error("connection_in_use");
    checked(result.error);
    if (!result.data) throw new Error("invalid");
    return "connection_removed";
  }, form.get("client_id"));
}
export async function createAccount(form: FormData) {
  await requireAdmin();
  await finish(async () => {
    const data = parse(accountSchema, form), db = adminDb();
    const externalId = normalizeAccountId(data.platform, data.external_id);
    if (!/^\d+$/.test(externalId)) throw new Error("invalid");
    const found = await db.from("connections").select("platform,owner_client_id").eq("id", data.connection_id).single();
    checked(found.error);
    if (!found.data || !canLinkConnection(found.data, data)) throw new Error("connection_mismatch");
    const manualMcc = data.platform === "google" && !found.data.owner_client_id ? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.replaceAll("-", "").trim() || null : null;
    if (manualMcc && !/^\d{1,40}$/.test(manualMcc)) throw new Error("invalid");
    const result = await db.from("ad_accounts").insert({ client_id: data.client_id, connection_id: data.connection_id, platform: data.platform, external_id: externalId,
      login_customer_id: manualMcc,
      lead_actions: [...new Set(data.lead_actions.split(",").map(s => s.trim()).filter(Boolean))] }).select("id").single();
    checked(result.error);
    if (!result.data) throw new Error("operation_failed");
    const summary = await syncAll(result.data.id, addDays(todayIn(), -89), todayIn());
    return summary.some(s => s.error) ? "account_saved_sync_failed" : "account_synced";
  });
}
export async function syncNow(form: FormData) {
  await requireAdmin();
  await finish(async () => {
    const { id, mode } = parse(z.object({ id: z.uuid(), mode: z.enum(["recent", "backfill"]) }), form);
    const summary = await syncAll(id, addDays(todayIn(), mode === "backfill" ? -89 : -6), todayIn());
    if (summary.some(s => s.error)) throw new Error("sync_failed");
    return "synced";
  }, form.get("client_id"));
}
export async function setAccountActive(form: FormData) {
  await requireAdmin();
  await finish(async () => {
    const data = parse(z.object({ id: z.uuid(), active: z.enum(["true", "false"]) }), form);
    const result = await adminDb().from("ad_accounts").update({ active: data.active === "true" }).eq("id", data.id).select("id").single();
    checked(result.error);
    if (!result.data) throw new Error("invalid");
  }, form.get("client_id"));
}
export async function linkUser(form: FormData) {
  const session = await requireAdmin();
  await finish(async () => {
    const data = parse(profileSchema, form), db = adminDb();
    let userId: string | undefined;
    for (let page = 1; page <= 100; page++) {
      const users = await db.auth.admin.listUsers({ page, perPage: 100 });
      checked(users.error);
      userId = users.data.users.find(u => u.email?.toLowerCase() === data.email.toLowerCase())?.id;
      if (userId || users.data.users.length < 100) break;
    }
    if (!userId) throw new Error("user_not_found");
    if (userId === session.user.id && data.role !== "admin") throw new Error("self_role");
    checked((await db.from("profiles").upsert({ user_id: userId, email: data.email.toLowerCase(), role: data.role, client_id: data.role === "client" ? data.client_id : null })).error);
  });
}
