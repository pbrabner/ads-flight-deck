"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/admin";
import { assertMetaAccountLink, getMetaAccount } from "@/lib/meta-accounts";
import { canLinkConnection } from "@/lib/validation";
import { syncAll } from "@/lib/sync";
import { addDays, todayIn } from "@/lib/period";

const selectionSchema = z.object({ connection_id: z.uuid(), client_id: z.uuid(), external_id: z.string().regex(/^\d{1,40}$/) });
export async function linkMetaAccount(form: FormData) {
  await requireAdmin();
  const parsed = selectionSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect("/admin?error=invalid");
  const data = parsed.data;
  let error = "", success = "account_synced";
  try {
    const db = adminDb();
    const [connection, client, existing] = await Promise.all([
      db.from("connections").select("id,platform,owner_client_id,access_token").eq("id", data.connection_id).single(),
      db.from("clients").select("id").eq("id", data.client_id).single(),
      db.from("ad_accounts").select("id,client_id").eq("platform", "meta").eq("external_id", data.external_id).maybeSingle(),
    ]);
    if (connection.error || client.error || existing.error || !connection.data || !client.data) throw new Error("invalid");
    if (!canLinkConnection(connection.data, { platform: "meta", client_id: data.client_id })) throw new Error("connection_mismatch");
    if (!connection.data.access_token) throw new Error("token_invalid");
    const account = await getMetaAccount(connection.data.access_token, data.external_id);
    assertMetaAccountLink(connection.data, data.client_id, account, existing.data);
    const values = { connection_id: data.connection_id, currency: account.currency, timezone: account.timezone, active: true };
    // Keep the existing client and legacy action configuration when reconnecting.
    const saved = existing.data
      ? await db.from("ad_accounts").update(values).eq("id", existing.data.id).eq("client_id", data.client_id).select("id").single()
      : await db.from("ad_accounts").insert({ ...values, client_id: data.client_id, platform: "meta", external_id: account.id, lead_actions: [] }).select("id").single();
    if (saved.error || !saved.data) throw new Error(saved.error?.code === "23505" ? "account_already_linked" : "operation_failed");
    try {
      const summary = await syncAll(saved.data.id, addDays(todayIn(), -89), todayIn());
      if (!summary.length || summary.some(s => s.error)) success = "account_saved_sync_failed";
    } catch { success = "account_saved_sync_failed"; }
  } catch (cause) {
    const allowed = ["invalid", "connection_mismatch", "token_invalid", "account_other_client", "unsupported_currency_or_timezone", "account_already_linked"];
    error = cause instanceof Error && allowed.includes(cause.message) ? cause.message : "operation_failed";
  }
  revalidatePath("/admin");
  revalidatePath(`/admin/connections/${data.connection_id}`);
  if (error) redirect(`/admin/connections/${data.connection_id}?client_id=${data.client_id}&error=${error}`);
  redirect(`/admin?client_id=${data.client_id}&success=${success}`);
}
