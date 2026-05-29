import { createAdminClient, getUserEmails } from "@/lib/supabase/admin";
import { sendNotificationEmail } from "@/lib/email/send";
import { sendPushNotificationToMany } from "./send-push";
import { getUserNotificationPrefs } from "./triggers";

// How long to wait after an assignment change before notifying, so the creator
// can finish setting up a new item (rename it, add/remove other assignees)
// without firing premature or churning emails.
const DEBOUNCE_MINUTES = 15;

// Safety cap so a single flush can never fan out unbounded work.
const FLUSH_BATCH_SIZE = 200;

// Stop retrying assignment email forever once the in-app notification exists.
const MAX_ASSIGNMENT_EMAIL_ATTEMPTS = 5;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://content.hearingtracker.com";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface AssignmentRecipient {
  userId: string;
  role: string;
}

interface OutboxRow {
  id: number;
  recipient_id: string;
  content_id: number;
  assigned_by: string | null;
  role: string;
  notification_id: number | null;
  email_sent_at: string | null;
  attempt_count: number | null;
}

function dedupeRecipients(
  recipients: AssignmentRecipient[]
): AssignmentRecipient[] {
  const byUser = new Map<string, AssignmentRecipient>();
  for (const recipient of recipients) {
    if (!byUser.has(recipient.userId)) {
      byUser.set(recipient.userId, recipient);
    }
  }
  return [...byUser.values()];
}

/**
 * Queue debounced "you were assigned" notifications for newly-assigned users.
 *
 * Re-running for the same (user, item) replaces any still-pending row, which
 * bumps `send_after` forward — the debounce. We delete-then-insert rather than
 * upsert because the uniqueness is enforced by a *partial* index
 * (WHERE sent_at IS NULL), which PostgREST upsert can't target reliably.
 */
export async function enqueueAssignmentNotifications(
  contentId: number,
  recipients: AssignmentRecipient[],
  assignedBy: string
): Promise<void> {
  const uniqueRecipients = dedupeRecipients(recipients);
  if (uniqueRecipients.length === 0) return;

  const supabase = createAdminClient();
  const userIds = uniqueRecipients.map((r) => r.userId);

  // Clear any pending (not-yet-sent) rows for these users on this item.
  const { error: deleteError } = await supabase
    .from("cp_notification_outbox")
    .delete()
    .eq("content_id", contentId)
    .is("sent_at", null)
    .in("recipient_id", userIds);

  if (deleteError) {
    console.error("[Outbox] Error clearing pending rows:", deleteError);
    return;
  }

  const sendAfter = new Date(
    Date.now() + DEBOUNCE_MINUTES * 60 * 1000
  ).toISOString();

  const { error: insertError } = await supabase
    .from("cp_notification_outbox")
    .insert(
      uniqueRecipients.map((r) => ({
        recipient_id: r.userId,
        content_id: contentId,
        assigned_by: assignedBy,
        role: r.role,
        send_after: sendAfter,
      }))
    );

  if (insertError) {
    console.error("[Outbox] Error enqueuing notifications:", insertError);
  }
}

/**
 * Cancel pending assignment notifications for users who were unassigned before
 * the debounce window elapsed (e.g. assigned then removed during setup).
 */
export async function cancelPendingAssignment(
  contentId: number,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("cp_notification_outbox")
    .delete()
    .eq("content_id", contentId)
    .is("sent_at", null)
    .in("recipient_id", userIds);

  if (error) {
    console.error("[Outbox] Error cancelling pending rows:", error);
  }
}

interface FlushResult {
  due: number;
  sent: number;
  skipped: number;
  failed: number;
}

interface AssignmentDeliveryResult {
  skipped: boolean;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Unknown error";
}

function cappedErrorMessage(message: string, attemptCount: number): string {
  return `${message} (stopped after ${attemptCount} attempts)`;
}

async function recordDeliveryFailure(
  supabase: AdminClient,
  row: OutboxRow,
  err: unknown
): Promise<void> {
  const nextAttemptCount = (row.attempt_count ?? 0) + 1;
  const message = errorMessage(err).slice(0, 1000);
  const shouldStopRetryingEmail =
    Boolean(row.notification_id) &&
    !row.email_sent_at &&
    nextAttemptCount >= MAX_ASSIGNMENT_EMAIL_ATTEMPTS;

  const { error } = await supabase
    .from("cp_notification_outbox")
    .update({
      attempt_count: nextAttemptCount,
      last_error: shouldStopRetryingEmail
        ? cappedErrorMessage(message, nextAttemptCount).slice(0, 1000)
        : message,
      ...(shouldStopRetryingEmail
        ? { sent_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", row.id);

  if (error) {
    console.error("[Outbox] Error recording delivery failure:", error);
  }
}

async function markOutboxDelivered(
  supabase: AdminClient,
  rowId: number
): Promise<boolean> {
  const { error } = await supabase
    .from("cp_notification_outbox")
    .update({ sent_at: new Date().toISOString(), last_error: null })
    .eq("id", rowId);

  if (error) {
    console.error("[Outbox] Error marking row sent:", error);
    return false;
  }

  return true;
}

async function ensureInAppAssignmentNotification(
  supabase: AdminClient,
  row: OutboxRow,
  title: string,
  body: string
): Promise<{ notificationId: number | null; created: boolean }> {
  if (row.notification_id) {
    return { notificationId: row.notification_id, created: false };
  }

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      recipient_id: row.recipient_id,
      notification_type: "assignment",
      title,
      body,
      entity_type: "content_item",
      entity_id: row.content_id,
      actor_id: row.assigned_by,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`create notification: ${error.message}`);
  }

  const notificationId = data?.id ?? null;
  if (!notificationId) {
    throw new Error("create notification: missing inserted notification id");
  }

  const { error: updateError } = await supabase
    .from("cp_notification_outbox")
    .update({ notification_id: notificationId })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(`record notification id: ${updateError.message}`);
  }

  row.notification_id = notificationId;
  return { notificationId, created: true };
}

async function deliverAssignmentNotification(
  supabase: AdminClient,
  row: OutboxRow,
  contentTitle: string,
  role: string
): Promise<AssignmentDeliveryResult> {
  const prefs = await getUserNotificationPrefs(
    row.recipient_id,
    "assignment",
    supabase
  );

  if (!prefs.shouldNotify) {
    return { skipped: true };
  }

  const title = `You were assigned as ${role} on "${contentTitle}"`;
  const body = `You have been assigned the ${role} role on this content item`;
  const actionUrl = `/content?item=${row.content_id}`;

  const { created } = await ensureInAppAssignmentNotification(
    supabase,
    row,
    title,
    body
  );

  if (created && prefs.browserEnabled) {
    try {
      const pushResult = await sendPushNotificationToMany([row.recipient_id], {
        title,
        body,
        url: actionUrl,
        tag: `assignment-${row.content_id}`,
      });
      if (pushResult.failed > 0) {
        console.error("[Outbox] Push delivery failures:", pushResult);
      }
    } catch (err) {
      console.error("[Outbox] Error sending push notification:", err);
    }
  }

  if (prefs.emailEnabled && !row.email_sent_at) {
    const emailMap = await getUserEmails([row.recipient_id]);
    const email = emailMap.get(row.recipient_id);

    if (!email) {
      console.error(
        "[Outbox] No email found for assignment recipient:",
        row.recipient_id
      );
      return { skipped: false };
    }

    const result = await sendNotificationEmail(
      email,
      title,
      body,
      `${SITE_URL}${actionUrl}`
    );

    if (!result.success) {
      throw new Error(result.error ?? "assignment email send failed");
    }

    const emailSentAt = new Date().toISOString();
    const { error } = await supabase
      .from("cp_notification_outbox")
      .update({
        email_sent_at: emailSentAt,
        email_message_id: result.messageId ?? null,
        last_error: null,
      })
      .eq("id", row.id);

    if (error) {
      throw new Error(`record email delivery: ${error.message}`);
    }

    row.email_sent_at = emailSentAt;
  }

  return { skipped: false };
}

/**
 * Deliver any due assignment notifications. Called by the flush cron.
 *
 * Each row is re-validated against the *current* state: the assignment must
 * still exist and the item must still be present. This means an assign-then-
 * unassign (or a deleted item) results in no email, and the notification always
 * reflects the item's current title.
 */
export async function flushNotificationOutbox(): Promise<FlushResult> {
  const supabase = createAdminClient();

  const { data: dueRows, error } = await supabase
    .from("cp_notification_outbox")
    .select(
      "id, recipient_id, content_id, assigned_by, role, notification_id, email_sent_at, attempt_count"
    )
    .is("sent_at", null)
    .lte("send_after", new Date().toISOString())
    .order("send_after", { ascending: true })
    .limit(FLUSH_BATCH_SIZE);

  if (error) {
    console.error("[Outbox] Error loading due rows:", error);
    return { due: 0, sent: 0, skipped: 0, failed: 0 };
  }

  if (!dueRows || dueRows.length === 0) {
    return { due: 0, sent: 0, skipped: 0, failed: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const staleIds: number[] = [];

  for (const row of dueRows as OutboxRow[]) {
    // The actor who assigned them should still exist; if the FK was nulled
    // (user deleted) drop the row rather than insert a null actor.
    if (!row.assigned_by) {
      staleIds.push(row.id);
      skipped++;
      continue;
    }

    // Assignment must still exist for this user on this item.
    const { data: assignments, error: assignmentsError } = await supabase
      .from("cp_content_assignments")
      .select("role")
      .eq("content_id", row.content_id)
      .eq("user_id", row.recipient_id);

    if (assignmentsError) {
      failed++;
      await recordDeliveryFailure(supabase, row, assignmentsError);
      continue;
    }

    if (!assignments || assignments.length === 0) {
      staleIds.push(row.id);
      skipped++;
      continue;
    }

    // Item must still exist; use its current title.
    const { data: contentItem, error: contentError } = await supabase
      .from("cp_content")
      .select("title")
      .eq("id", row.content_id)
      .maybeSingle();

    if (contentError) {
      failed++;
      await recordDeliveryFailure(supabase, row, contentError);
      continue;
    }

    if (!contentItem) {
      staleIds.push(row.id);
      skipped++;
      continue;
    }

    // Prefer the originally-queued role if still present, else any current one.
    const role =
      assignments.find((a) => a.role === row.role)?.role ?? assignments[0].role;

    try {
      const result = await deliverAssignmentNotification(
        supabase,
        row,
        contentItem.title,
        role
      );

      if (await markOutboxDelivered(supabase, row.id)) {
        if (result.skipped) {
          skipped++;
        } else {
          sent++;
        }
      }
    } catch (err) {
      failed++;
      await recordDeliveryFailure(supabase, row, err);
      console.error("[Outbox] Error delivering notification:", err);
    }
  }

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("cp_notification_outbox")
      .delete()
      .in("id", staleIds);
    if (deleteError) {
      console.error("[Outbox] Error deleting stale rows:", deleteError);
    }
  }

  return { due: dueRows.length, sent, skipped, failed };
}
