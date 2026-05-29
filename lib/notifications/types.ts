export type NotificationType =
  | "comment_on_assigned"
  | "mention"
  | "assignment"
  | "daily_digest";

export interface EventPreferences {
  comment_on_assigned: boolean;
  mention: boolean;
  assignment: boolean;
  daily_digest: boolean;
}

export interface NotificationPreferences {
  user_id: string;
  notifications_enabled: boolean;
  browser_enabled: boolean;
  email_enabled: boolean;
  event_preferences: EventPreferences;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: number;
  recipient_id: string;
  notification_type: NotificationType;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: number | null;
  comment_id: number | null;
  actor_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PushSubscription {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  created_at: string;
}

export interface CreateNotificationInput {
  recipient_id: string;
  notification_type: NotificationType;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: number;
  comment_id?: number;
  actor_id?: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
}
