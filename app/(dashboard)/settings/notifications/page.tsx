import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getNotificationPreferences } from "./actions";
import { NotificationSettingsForm } from "./components/notification-settings-form";
import type { NotificationPreferences, EventPreferences } from "@/lib/notifications/types";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const preferences = await getNotificationPreferences();

  // Use defaults if no preferences exist
  const defaultPreferences: NotificationPreferences = {
    user_id: user.id,
    notifications_enabled: true,
    browser_enabled: true,
    email_enabled: true,
    event_preferences: {
      comment_on_assigned: true,
      mention: true,
      assignment: true,
      daily_digest: true,
    } as EventPreferences,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Notification Settings
        </h2>
        <p className="text-muted-foreground">
          Manage how and when you receive notifications
        </p>
      </div>

      <NotificationSettingsForm
        initialPreferences={preferences || defaultPreferences}
      />
    </div>
  );
}
