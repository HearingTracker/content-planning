// Sends the daily "outstanding items" email digest. Vercel cron runs this on
// weekday mornings (vercel.json) and sends `Authorization: Bearer $CRON_SECRET`.

import { NextResponse } from "next/server";
import { sendDailyDigests } from "@/lib/notifications/digest";

export const maxDuration = 120;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await sendDailyDigests();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron daily-digest] failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;
