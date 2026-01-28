"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotificationToMany } from "./send-push";
import { sendNotificationEmail } from "@/lib/email/send";
import type { NotificationType, EventPreferences } from "./types";

interface NotifyOptions {
  recipientIds: string[];
  notificationType: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: number;
  commentId?: number;
  actorId: string;
  excludeActorFromRecipients?: boolean;
}

interface UserPrefs {
  shouldNotify: boolean;
  browserEnabled: boolean;
  emailEnabled: boolean;
}

async function getUserNotificationPrefs(
  userId: string,
  eventType: NotificationType
): Promise<UserPrefs> {
  const supabase = await createClient();

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("notifications_enabled, browser_enabled, email_enabled, event_preferences")
    .eq("user_id", userId)
    .single();

  if (!prefs) {
    // Default to true if no preferences exist
    return { shouldNotify: true, browserEnabled: true, emailEnabled: true };
  }

  if (!prefs.notifications_enabled) {
    return { shouldNotify: false, browserEnabled: false, emailEnabled: false };
  }

  const eventPrefs = prefs.event_preferences as EventPreferences | null;
  const eventEnabled = eventPrefs ? (eventPrefs[eventType] ?? true) : true;

  return {
    shouldNotify: eventEnabled,
    browserEnabled: prefs.browser_enabled && eventEnabled,
    emailEnabled: prefs.email_enabled && eventEnabled,
  };
}

async function createNotifications(options: NotifyOptions): Promise<void> {
  const supabase = await createClient();

  const recipientsToNotify = options.excludeActorFromRecipients
    ? options.recipientIds.filter((id) => id !== options.actorId)
    : options.recipientIds;

  // Check preferences for each recipient and filter
  const recipientsWithPermission: string[] = [];
  const recipientsForPush: string[] = [];
  const recipientsForEmail: string[] = [];

  for (const recipientId of recipientsToNotify) {
    const prefs = await getUserNotificationPrefs(recipientId, options.notificationType);
    if (prefs.shouldNotify) {
      recipientsWithPermission.push(recipientId);
      if (prefs.browserEnabled) {
        recipientsForPush.push(recipientId);
      }
      if (prefs.emailEnabled) {
        recipientsForEmail.push(recipientId);
      }
    }
  }

  if (recipientsWithPermission.length === 0) {
    return;
  }

  const notifications = recipientsWithPermission.map((recipientId) => ({
    recipient_id: recipientId,
    notification_type: options.notificationType,
    title: options.title,
    body: options.body,
    entity_type: options.entityType,
    entity_id: options.entityId,
    comment_id: options.commentId,
    actor_id: options.actorId,
  }));

  const { error } = await supabase.from("notifications").insert(notifications);

  if (error) {
    console.error("Error creating notifications:", error);
    return;
  }

  let actionUrl = "/";
  if (options.entityId) {
    switch (options.entityType) {
      case "content_item":
        actionUrl = `/content?item=${options.entityId}`;
        if (options.commentId) {
          actionUrl += `&comment=${options.commentId}`;
        }
        break;
      case "content_brief":
        actionUrl = `/strategy?tab=briefs&brief=${options.entityId}`;
        break;
      case "content_idea":
        actionUrl = `/strategy?tab=ideas&idea=${options.entityId}`;
        break;
    }
  }

  // Send push notifications to users who have browser notifications enabled
  if (recipientsForPush.length > 0) {
    sendPushNotificationToMany(recipientsForPush, {
      title: options.title,
      body: options.body,
      url: actionUrl,
      tag: `${options.notificationType}-${options.entityId || "general"}`,
    }).catch((err) => {
      console.error("Error sending push notifications:", err);
    });
  }

  // Send email notifications to users who have email notifications enabled
  if (recipientsForEmail.length > 0) {
    sendEmailNotifications(recipientsForEmail, options.title, options.body, actionUrl).catch(
      (err) => {
        console.error("Error sending email notifications:", err);
      }
    );
  }
}

/**
 * Send email notifications to multiple users
 */
async function sendEmailNotifications(
  userIds: string[],
  title: string,
  body?: string,
  actionUrl?: string
): Promise<void> {
  const { getUserEmails } = await import("@/lib/supabase/admin");

  const emailMap = await getUserEmails(userIds);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://content.hearingtracker.com";
  const fullActionUrl = actionUrl ? `${baseUrl}${actionUrl}` : baseUrl;

  await Promise.all(
    Array.from(emailMap.entries()).map(async ([, email]) => {
      try {
        await sendNotificationEmail(email, title, body || "", fullActionUrl);
      } catch (err) {
        console.error(`[Email] Error sending to ${email}:`, err);
      }
    })
  );
}

/**
 * Notify users about a new comment on a content item.
 * Consolidates notifications so each user only receives one notification,
 * with mentions taking priority over general assignment notifications.
 */
export async function notifyComment(
  contentItemId: number,
  contentTitle: string,
  commentBody: string,
  commentId: number,
  actorId: string,
  mentionedUserIds: string[] = []
): Promise<void> {
  const supabase = await createClient();

  // Get all users assigned to this content item
  const { data: assignments } = await supabase
    .from("cp_content_assignments")
    .select("user_id")
    .eq("content_item_id", contentItemId);

  // Dedupe assigned user IDs
  const assignedUserIds = [...new Set(assignments?.map((a) => a.user_id) || [])];

  // Dedupe mentioned user IDs
  const uniqueMentionedIds = [...new Set(mentionedUserIds)];

  // Truncate comment body for notification
  const truncatedBody =
    commentBody.length > 100
      ? commentBody.substring(0, 100) + "..."
      : commentBody;

  // Users who were mentioned get a mention notification (higher priority)
  if (uniqueMentionedIds.length > 0) {
    await createNotifications({
      recipientIds: uniqueMentionedIds,
      notificationType: "mention",
      title: `You were mentioned in "${contentTitle}"`,
      body: truncatedBody,
      entityType: "content_item",
      entityId: contentItemId,
      commentId,
      actorId,
      excludeActorFromRecipients: true,
    });
  }

  // Assigned users who were NOT mentioned get a comment notification
  const assignedButNotMentioned = assignedUserIds.filter(
    (id) => !uniqueMentionedIds.includes(id)
  );

  if (assignedButNotMentioned.length > 0) {
    await createNotifications({
      recipientIds: assignedButNotMentioned,
      notificationType: "comment_on_assigned",
      title: `New comment on "${contentTitle}"`,
      body: truncatedBody,
      entityType: "content_item",
      entityId: contentItemId,
      commentId,
      actorId,
      excludeActorFromRecipients: true,
    });
  }
}

/**
 * @deprecated Use notifyComment instead for consolidated notifications
 */
export async function notifyCommentOnAssigned(
  contentItemId: number,
  contentTitle: string,
  commentBody: string,
  commentId: number,
  actorId: string
): Promise<void> {
  return notifyComment(contentItemId, contentTitle, commentBody, commentId, actorId, []);
}

/**
 * @deprecated Use notifyComment instead for consolidated notifications
 */
export async function notifyMention(
  mentionedUserIds: string[],
  contentItemId: number,
  contentTitle: string,
  commentId: number,
  mentionedBy: string
): Promise<void> {
  // This is now a no-op when called separately since notifyComment handles mentions
  // Kept for backwards compatibility but should migrate callers to notifyComment
}

/**
 * Notify a user when they are assigned to a content item
 */
export async function notifyAssignment(
  assignedUserId: string,
  contentItemId: number,
  contentTitle: string,
  role: string,
  assignedBy: string
): Promise<void> {
  await createNotifications({
    recipientIds: [assignedUserId],
    notificationType: "assignment",
    title: `You were assigned as ${role} on "${contentTitle}"`,
    body: `You have been assigned the ${role} role on this content item`,
    entityType: "content_item",
    entityId: contentItemId,
    actorId: assignedBy,
    excludeActorFromRecipients: true,
  });
}
