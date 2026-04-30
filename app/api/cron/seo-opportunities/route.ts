// Nightly cron + manual trigger entry point. Vercel cron sends
// `Authorization: Bearer $CRON_SECRET`. The in-app "Refresh Now" button does
// NOT call this route — it invokes syncSeoOpportunities() directly via a
// server action, which avoids dev-server self-fetch fragility.

import { NextResponse } from "next/server";
import { syncSeoOpportunities } from "@/lib/seo/sync";

export const maxDuration = 300; // ~2min run, with headroom

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await syncSeoOpportunities();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron seo-opportunities] failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;
