import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { appUrl, requiredEnv } from "@/lib/env";
import { oauthAdmin } from "@/lib/oauth-server";
import { authorizationUrl } from "@/lib/oauth";
import { platformSchema } from "@/lib/validation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const parsed = platformSchema.safeParse((await params).platform);
  if (!parsed.success) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const session = await oauthAdmin();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const platform = parsed.data, owner = request.nextUrl.searchParams.get("owner");
  if (owner) {
    if (!z.uuid().safeParse(owner).success) return NextResponse.json({ error: "invalid_owner" }, { status: 400 });
    const result = await session.db.from("clients").select("id").eq("id", owner).single();
    if (result.error || !result.data) return NextResponse.json({ error: "invalid_owner" }, { status: 400 });
  }
  try {
    const origin = appUrl(), callback = `${origin}/api/oauth/${platform}/callback`;
    const clientId = requiredEnv(platform === "google" ? "GOOGLE_CLIENT_ID" : "META_APP_ID");
    requiredEnv(platform === "google" ? "GOOGLE_CLIENT_SECRET" : "META_APP_SECRET");
    const mode = platform === "meta" && request.nextUrl.searchParams.get("mode") === "manage" ? "manage" : "read";
    const state = { nonce: randomBytes(32).toString("hex"), user: session.user.id, owner, mode, expires: Date.now() + 600_000 };
    (await cookies()).set(`afd_oauth_${platform}`, JSON.stringify(state), {
      httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", maxAge: 600, path: `/api/oauth/${platform}`,
    });
    return NextResponse.redirect(authorizationUrl(platform, clientId, callback, state.nonce, mode));
  } catch { return NextResponse.redirect(new URL("/admin?error=oauth_config", request.url)); }
}
