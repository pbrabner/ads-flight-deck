"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { assertGoogleAccountLink, getGoogleAccount } from "@/lib/google-accounts";
import { refreshAccessToken } from "@/lib/connectors/google";
import { canLinkConnection } from "@/lib/validation";
import { syncAll } from "@/lib/sync";
import { addDays, todayIn } from "@/lib/period";

const selectionSchema = z.object({
  connection_id: z.uuid(), client_id: z.uuid(), external_id: z.string().regex(/^\d{1,40}$/),
  login_customer_id: z.union([z.string().regex(/^\d{1,40}$/), z.literal("")]).default(""),
});
export async function linkGoogleAccount(form: FormData) {
  await requireAdmin();
  const parsed = selectionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin?error=invalid");
  const data = parsed.data;
  let error = "", success = "account_synced";
  try {
    const db = adminDb();
    const [connection, client, existing] = await Promise.all([
      db.from("connections").select("id,platform,owner_client_id,refresh_token").eq("id", data.connection_id).single(),
      db.from("clients").select("id").eq("id", data.client_id).single(),
      db.from("ad_accounts").select("id,client_id").eq("platform", "google").eq("external_id", data.external_id).maybeSingle(),
    ]);
    if (connection.error || client.error || existing.error || !connection.data || !client.data) throw new Error("invalid");
    if (!canLinkConnection(connection.data, { platform: "google", client_id: data.client_id })) throw new Error("connection_mismatch");
    if (existing.data && existing.data.client_id !== data.client_id) throw new Error("account_other_client");
    if (!connection.data.refresh_token) throw new Error("token_invalid");
    const accessToken = await refreshAccessToken(connection.data.refresh_token);
    // The submitted MCC is only a route: Google must authorize this exact customer now.
    const account = await getGoogleAccount(accessToken, data.external_id, data.login_customer_id || undefined);
    assertGoogleAccountLink(connection.data, data.client_id, account, existing.data);
    const values = { connection_id: data.connection_id, login_customer_id: account.loginCustomerId || null, currency: account.currency, timezone: account.timezone, active: true };
    // Reconnecting keeps the existing client and configured conversion actions.
    const saved = existing.data
      ? await db.from("ad_accounts").update(values).eq("id", existing.data.id).eq("client_id", data.client_id).select("id").single()
      : await db.from("ad_accounts").insert({ ...values, client_id: data.client_id, platform: "google", external_id: account.id, lead_actions: [] }).select("id").single();
    if (saved.error || !saved.data) throw new Error(saved.error?.code === "23505" ? "account_already_linked" : "operation_failed");
    try {
      const summary = await syncAll(saved.data.id, addDays(todayIn(), -89), todayIn());
      if (!summary.length || summary.some(s => s.error)) success = "account_saved_sync_failed";
    } catch { success = "account_saved_sync_failed"; }
  } catch (cause) {
    const allowed = ["invalid", "connection_mismatch", "token_invalid", "account_other_client", "unsupported_account", "account_already_linked", "google_production_access_required"];
    error = cause instanceof Error && allowed.includes(cause.message) ? cause.message : "operation_failed";
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/google-connections/${data.connection_id}`);
  if (error) redirect(`/admin/google-connections/${data.connection_id}?client_id=${data.client_id}&error=${error}`);
  redirect(`/admin?client_id=${data.client_id}&success=${success}`);
}
