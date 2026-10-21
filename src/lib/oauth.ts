import type { Platform } from "./connectors/types";
import { validSecret } from "./security";
export function authorizationUrl(platform: Platform, clientId: string, redirect: string, state: string, mode: "read" | "manage" = "read"): string {
  const url = new URL(platform === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : `https://www.facebook.com/${process.env.META_API_VERSION || "v25.0"}/dialog/oauth`);
  const params = { client_id: clientId, redirect_uri: redirect, state, response_type: "code",
    scope: platform === "google" ? "https://www.googleapis.com/auth/adwords" : mode === "manage" ? "ads_read,ads_management" : "ads_read",
    ...(platform === "google" ? { access_type: "offline", prompt: "consent" } : {}) };
  url.search = new URLSearchParams(params).toString();
  return url.toString();
}
export function validOAuthState(state: { nonce: string; user: string; expires: number }, nonce: string, user: string, now = Date.now()): boolean {
  return state.user === user && state.expires > now && validSecret(state.nonce, nonce);
}
