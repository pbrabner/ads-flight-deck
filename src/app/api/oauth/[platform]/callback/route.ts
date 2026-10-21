import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { appUrl } from "@/lib/env";
import { oauthAdmin, exchangeCode } from "@/lib/oauth-server";
import { validOAuthState } from "@/lib/oauth";
import { platformSchema } from "@/lib/validation";
import { adminDb } from "@/lib/supabase/admin";

const stateSchema = z.object({ nonce: z.string().length(64), user: z.uuid(), owner: z.uuid().nullable(), expires: z.number(), mode: z.enum(["read", "manage"]).default("read") });
export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const parsed = platformSchema.safeParse((await params).platform);
  if (!parsed.success) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const platform = parsed.data;
  const store = await cookies(), raw = store.get(`afd_oauth_${platform}`)?.value;
  store.set(`afd_oauth_${platform}`, "", { maxAge: 0, path: `/api/oauth/${platform}`, httpOnly: true, sameSite: "lax" });
  const session = await oauthAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  try {
    const state = stateSchema.parse(JSON.parse(raw || "{}"));
    const nonce = request.nextUrl.searchParams.get("state") || "", code = request.nextUrl.searchParams.get("code");
    if (!validOAuthState(state, nonce, session.user.id) || !code || request.nextUrl.searchParams.has("error")) throw new Error("invalid_state");
    const origin = appUrl();
    const token = await exchangeCode(platform, code, `${origin}/api/oauth/${platform}/callback`);
    const { data, error } = await adminDb().from("connections").insert({
      platform, label: `${platform === "meta" ? "Meta Ads" : "Google Ads"} via OAuth${platform === "meta" && state.mode === "manage" ? " · Gerenciamento" : ""}`, owner_client_id: state.owner, ...token,
    }).select("id").single();
    if (error || !data) throw new Error("save_failed");
    return NextResponse.redirect(new URL(platform === "meta" ? `/admin/connections/${data.id}` : `/admin/google-connections/${data.id}`, origin));
  } catch { return NextResponse.redirect(new URL("/admin?error=oauth_failed", request.url)); }
}
