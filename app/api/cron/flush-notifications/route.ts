// Flushes due, debounced assignment notifications from cp_notification_outbox.
// Vercel cron runs this every ~10 min (vercel.json) and sends
// `Authorization: Bearer $CRON_SECRET`.

import { NextResponse } from "next/server";
import { flushNotificationOutbox } from "@/lib/notifications/outbox";

export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  try {
    const result = await flushNotificationOutbox();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron flush-notifications] failed:", err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export const POST = GET;
