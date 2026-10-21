import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validSecret } from "@/lib/security";
import { isDate, addDays, todayIn } from "@/lib/period";
import { syncAll } from "@/lib/sync";
export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });
  if (!validSecret(request.headers.get("authorization") || "", `Bearer ${secret}`)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const account = params.get("account") || undefined, from = params.get("from") || addDays(todayIn(), -6), to = params.get("to") || todayIn();
  if ((account && !z.uuid().safeParse(account).success) || params.has("from") !== params.has("to")
    || !isDate(from) || !isDate(to) || from > to || Date.parse(to) - Date.parse(from) > 366 * 86_400_000) {
    return NextResponse.json({ ok: false, error: "invalid_parameters" }, { status: 400 });
  }
  try {
    const summary = await syncAll(account, from, to);
    const ok = summary.every(row => !row.error);
    return NextResponse.json({ ok, summary }, { status: ok ? 200 : 207, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ ok: false, error: "sync_failed" }, { status: 500 }); }
}
