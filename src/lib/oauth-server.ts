import "server-only";
import { serverDb } from "./supabase/server";
import { supabaseConfig, requiredEnv } from "./env";
import { fetchJson } from "./connectors/http";
import { asRecord, type Platform } from "./connectors/types";

export async function oauthAdmin() {
  if (!supabaseConfig()) return null;
  const db = await serverDb();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) return null;
  const profile = await db.from("profiles").select("role").eq("user_id", user.id).single();
  if (profile.error || profile.data?.role !== "admin") return null;
  return { user, db };
}
export async function exchangeCode(platform: Platform, code: string, redirect: string) {
  if (platform === "google") {
    const data = asRecord(await fetchJson("https://oauth2.googleapis.com/token", { method: "POST",
      body: new URLSearchParams({ code, grant_type: "authorization_code", client_id: requiredEnv("GOOGLE_CLIENT_ID"), client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"), redirect_uri: redirect }) }));
    if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string") throw new Error("invalid_response");
    return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: null };
  }
  const base = `https://graph.facebook.com/${process.env.META_API_VERSION || "v25.0"}/oauth/access_token`;
  const short = asRecord(await fetchJson(`${base}?${new URLSearchParams({ client_id: requiredEnv("META_APP_ID"), client_secret: requiredEnv("META_APP_SECRET"), redirect_uri: redirect, code })}`));
  if (typeof short.access_token !== "string") throw new Error("invalid_response");
  const long = asRecord(await fetchJson(`${base}?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: requiredEnv("META_APP_ID"), client_secret: requiredEnv("META_APP_SECRET"), fb_exchange_token: short.access_token })}`));
  if (typeof long.access_token !== "string") throw new Error("invalid_response");
  return { access_token: long.access_token, refresh_token: null,
    expires_at: typeof long.expires_in === "number" ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null };
}
