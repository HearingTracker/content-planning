import { createAdminClient } from "@/lib/supabase/admin";
import { getUserEmails } from "@/lib/supabase/admin";
import { sendDigestEmail } from "@/lib/email/send";
import type { EventPreferences } from "./types";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://content.hearingtracker.com";

// Window (in days) for flagging an item as "due soon".
const DUE_SOON_DAYS = 3;

interface DigestItem {
  id: number;
  title: string;
  due_date: string | null;
  statusName: string | null;
}

interface DigestResult {
  usersWithItems: number;
  emailsSent: number;
}

type DigestStatus = "pending" | "sent" | "failed";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Today / due-soon cutoff as YYYY-MM-DD in US Eastern (digest runs ~7am ET).
// due_date is a DATE column, so lexicographic comparison on ISO strings works.
function easternDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function digestEmailEnabled(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<boolean> {
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("notifications_enabled, email_enabled, event_preferences")
    .eq("user_id", userId)
    .single();

  // No preferences row → defaults are all-on.
  if (!prefs) return true;
  if (!prefs.notifications_enabled || !prefs.email_enabled) return false;

  const eventPrefs = prefs.event_preferences as EventPreferences | null;
  return eventPrefs ? (eventPrefs.daily_digest ?? true) : true;
}

function renderSection(title: string, items: DigestItem[]): string {
  if (items.length === 0) return "";
  const rows = items
    .map((item) => {
      const url = `${SITE_URL}/content?item=${item.id}`;
      const due = item.due_date
        ? ` <span style="color:#6b7280;">— due ${item.due_date}</span>`
        : "";
      const status = item.statusName
        ? ` <span style="color:#9ca3af;">(${escapeHtml(item.statusName)})</span>`
        : "";
      return `<li style="margin-bottom:6px;"><a href="${url}">${escapeHtml(
        item.title
      )}</a>${due}${status}</li>`;
    })
    .join("");
  return `<h3 style="margin:16px 0 8px;">${title}</h3><ul style="padding-left:18px;margin:0;">${rows}</ul>`;
}

function buildDigestHtml(items: DigestItem[], todayStr: string, soonStr: string) {
  const overdue: DigestItem[] = [];
  const dueSoon: DigestItem[] = [];
  const rest: DigestItem[] = [];

  for (const item of items) {
    if (item.due_date && item.due_date < todayStr) overdue.push(item);
    else if (item.due_date && item.due_date <= soonStr) dueSoon.push(item);
    else rest.push(item);
  }

  // Within each section, sort dated items by due date ascending.
  const byDue = (a: DigestItem, b: DigestItem) =>
    (a.due_date ?? "").localeCompare(b.due_date ?? "");
  overdue.sort(byDue);
  dueSoon.sort(byDue);

  const html = [
    `<h2 style="margin:0 0 4px;">Your open content tasks</h2>`,
    `<p style="color:#6b7280;margin:0 0 8px;">${items.length} item${
      items.length === 1 ? "" : "s"
    } assigned to you and not yet published.</p>`,
    renderSection("⚠️ Overdue", overdue),
    renderSection("⏳ Due soon", dueSoon),
    renderSection("Open", rest),
    `<p style="margin-top:16px;"><a href="${SITE_URL}/content">Open the content board</a></p>`,
  ]
    .filter(Boolean)
    .join("");

  const text = items
    .map((i) => `- ${i.title}${i.due_date ? ` (due ${i.due_date})` : ""}`)
    .join("\n");

  return { html, text };
}

async function reserveDailyDigest(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  digestDate: string,
  itemCount: number,
  nowIso: string
): Promise<boolean> {
  const { error } = await supabase.from("cp_daily_digest_deliveries").insert({
    user_id: userId,
    digest_date: digestDate,
    status: "pending" satisfies DigestStatus,
    item_count: itemCount,
    last_attempt_at: nowIso,
  });

  if (!error) return true;

  if (error.code === "23505") {
    const { data: reclaimed, error: reclaimError } = await supabase
      .from("cp_daily_digest_deliveries")
      .update({
        status: "pending" satisfies DigestStatus,
        item_count: itemCount,
        message_id: null,
        last_error: null,
        last_attempt_at: nowIso,
        sent_at: null,
      })
      .eq("user_id", userId)
      .eq("digest_date", digestDate)
      .eq("status", "failed")
      .select("user_id")
      .maybeSingle();

    if (reclaimError) {
      console.error("[Digest] Error reclaiming failed digest:", reclaimError);
      return false;
    }

    return Boolean(reclaimed);
  }

  console.error("[Digest] Error reserving daily digest:", error);
  return false;
}

async function updateDailyDigestDelivery(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  digestDate: string,
  updates: {
    status: DigestStatus;
    sent_at?: string | null;
    message_id?: string | null;
    last_error?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("cp_daily_digest_deliveries")
    .update(updates)
    .eq("user_id", userId)
    .eq("digest_date", digestDate);

  if (error) {
    console.error("[Digest] Error updating daily digest delivery:", error);
  }
}

/**
 * Build and send the daily "outstanding items" digest. One email per user who
 * has at least one open (non-terminal) content item assigned to them. Email
 * only — no in-app notification or push. Respects notification preferences.
 *
 * Called by /api/cron/daily-digest.
 */
export async function sendDailyDigests(): Promise<DigestResult> {
  const supabase = createAdminClient();

  // Status lookup: terminal ids to exclude, names for display.
  const { data: statuses } = await supabase
    .from("cp_workflow_statuses")
    .select("id, name, is_terminal");
  const terminalIds = new Set(
    (statuses ?? []).filter((s) => s.is_terminal).map((s) => s.id)
  );
  const statusName = new Map(
    (statuses ?? []).map((s) => [s.id, s.name as string])
  );

  // Open content items (exclude terminal statuses; null status counts as open).
  const { data: contentRows, error: contentError } = await supabase
    .from("cp_content")
    .select("id, title, due_date, workflow_status_id")
    .eq("stage", "content");

  if (contentError) {
    console.error("[Digest] Error loading content:", contentError);
    return { usersWithItems: 0, emailsSent: 0 };
  }

  const openItems = new Map<number, DigestItem>();
  for (const row of contentRows ?? []) {
    if (row.workflow_status_id && terminalIds.has(row.workflow_status_id)) {
      continue;
    }
    openItems.set(row.id, {
      id: row.id,
      title: row.title,
      due_date: row.due_date,
      statusName: row.workflow_status_id
        ? statusName.get(row.workflow_status_id) ?? null
        : null,
    });
  }

  if (openItems.size === 0) {
    return { usersWithItems: 0, emailsSent: 0 };
  }

  // Assignments for those open items, grouped by user.
  const { data: assignments, error: assignError } = await supabase
    .from("cp_content_assignments")
    .select("user_id, content_id")
    .in("content_id", [...openItems.keys()]);

  if (assignError) {
    console.error("[Digest] Error loading assignments:", assignError);
    return { usersWithItems: 0, emailsSent: 0 };
  }

  const itemsByUser = new Map<string, DigestItem[]>();
  for (const a of assignments ?? []) {
    const item = openItems.get(a.content_id);
    if (!item) continue;
    const list = itemsByUser.get(a.user_id) ?? [];
    // A user can hold multiple roles on one item; only list it once.
    if (!list.some((i) => i.id === item.id)) list.push(item);
    itemsByUser.set(a.user_id, list);
  }

  if (itemsByUser.size === 0) {
    return { usersWithItems: 0, emailsSent: 0 };
  }

  const now = new Date();
  const todayStr = easternDate(now);
  const nowIso = now.toISOString();
  const soonStr = easternDate(
    new Date(now.getTime() + DUE_SOON_DAYS * 24 * 60 * 60 * 1000)
  );

  const userIds = [...itemsByUser.keys()];
  const emailMap = await getUserEmails(userIds);

  let emailsSent = 0;
  for (const userId of userIds) {
    const items = itemsByUser.get(userId)!;

    if (!(await digestEmailEnabled(supabase, userId))) continue;

    const email = emailMap.get(userId);
    if (!email) continue;

    const reserved = await reserveDailyDigest(
      supabase,
      userId,
      todayStr,
      items.length,
      nowIso
    );
    if (!reserved) continue;

    const { html, text } = buildDigestHtml(items, todayStr, soonStr);
    const subject = `Your content tasks: ${items.length} open item${
      items.length === 1 ? "" : "s"
    }`;

    try {
      const result = await sendDigestEmail(email, subject, html, text);
      if (result.success) {
        await updateDailyDigestDelivery(supabase, userId, todayStr, {
          status: "sent",
          sent_at: new Date().toISOString(),
          message_id: result.messageId ?? null,
          last_error: null,
        });
        emailsSent++;
      } else {
        await updateDailyDigestDelivery(supabase, userId, todayStr, {
          status: "failed",
          last_error: result.error ?? "digest email send failed",
        });
      }
    } catch (err) {
      console.error(`[Digest] Error sending to ${email}:`, err);
      await updateDailyDigestDelivery(supabase, userId, todayStr, {
        status: "failed",
        last_error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { usersWithItems: itemsByUser.size, emailsSent };
}
