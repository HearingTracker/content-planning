import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:notifications@example.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  notificationId?: number;
}

/**
 * Send a push notification to all subscribed devices for a user
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn("[Push] VAPID keys not configured, skipping push notification");
    return { sent: 0, failed: 0 };
  }

  const supabase = createAdminClient();

  // Get all push subscriptions for this user
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh_key, auth_key")
    .eq("user_id", userId);

  if (error) {
    console.error("[Push] Error fetching subscriptions:", error);
    return { sent: 0, failed: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const failedSubscriptionIds: number[] = [];

  // Send to all subscriptions
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh_key,
              auth: sub.auth_key,
            },
          },
          JSON.stringify(payload)
        );
        sent++;
      } catch (err: unknown) {
        failed++;
        // If subscription is invalid (410 Gone or 404), mark for deletion
        if (err && typeof err === "object" && "statusCode" in err) {
          const statusCode = (err as { statusCode: number }).statusCode;
          if (statusCode === 410 || statusCode === 404) {
            failedSubscriptionIds.push(sub.id);
          }
        }
        console.error("[Push] Error sending to subscription:", err);
      }
    })
  );

  // Clean up invalid subscriptions
  if (failedSubscriptionIds.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("id", failedSubscriptionIds);
  }

  return { sent, failed };
}

/**
 * Send push notifications to multiple users
 */
export async function sendPushNotificationToMany(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  await Promise.all(
    userIds.map(async (userId) => {
      const result = await sendPushNotification(userId, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
    })
  );

  return { sent: totalSent, failed: totalFailed };
}
