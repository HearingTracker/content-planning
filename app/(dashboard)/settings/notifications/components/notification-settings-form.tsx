"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Bell, Mail, Monitor, MessageSquare, AtSign, UserPlus } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { updateNotificationPreferences } from "../actions";
import type { NotificationPreferences, EventPreferences } from "@/lib/notifications/types";

interface NotificationSettingsFormProps {
  initialPreferences: NotificationPreferences;
}

export function NotificationSettingsForm({
  initialPreferences,
}: NotificationSettingsFormProps) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading: isPushLoading,
    error: pushError,
    subscribe,
    unsubscribe,
  } = usePushNotifications();

  const handleToggle = (
    field: keyof Omit<NotificationPreferences, "user_id" | "event_preferences" | "created_at" | "updated_at">
  ) => {
    const newValue = !preferences[field];
    setPreferences((prev) => ({ ...prev, [field]: newValue }));

    startTransition(async () => {
      const result = await updateNotificationPreferences({ [field]: newValue });
      if (result.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        // Revert on error
        setPreferences((prev) => ({ ...prev, [field]: !newValue }));
      }
    });
  };

  const handleEventToggle = (event: keyof EventPreferences) => {
    const newEventPrefs = {
      ...preferences.event_preferences,
      [event]: !preferences.event_preferences[event],
    };
    setPreferences((prev) => ({ ...prev, event_preferences: newEventPrefs }));

    startTransition(async () => {
      const result = await updateNotificationPreferences({
        event_preferences: newEventPrefs,
      });
      if (result.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else {
        setSaveStatus("error");
        // Revert on error
        setPreferences((prev) => ({
          ...prev,
          event_preferences: {
            ...prev.event_preferences,
            [event]: !prev.event_preferences[event],
          },
        }));
      }
    });
  };

  const handleBrowserSubscribe = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <div className="space-y-6">
      {saveStatus === "saved" && (
        <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400 px-4 py-2 rounded-md">
          Settings saved successfully
        </div>
      )}
      {saveStatus === "error" && (
        <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-4 py-2 rounded-md">
          Failed to save settings
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Global Settings
          </CardTitle>
          <CardDescription>
            Control whether you receive notifications at all
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-enabled">Enable Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Turn off to mute all notifications
              </p>
            </div>
            <Checkbox
              id="notifications-enabled"
              checked={preferences.notifications_enabled}
              onCheckedChange={() => handleToggle("notifications_enabled")}
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="size-5" />
            Browser Notifications
          </CardTitle>
          <CardDescription>
            Receive push notifications in your browser
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="browser-enabled">Browser Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get notified even when the app is in the background
              </p>
            </div>
            <Checkbox
              id="browser-enabled"
              checked={preferences.browser_enabled}
              onCheckedChange={() => handleToggle("browser_enabled")}
              disabled={isPending || !preferences.notifications_enabled}
            />
          </div>

          {preferences.browser_enabled && isSupported && (
            <div className="border-t pt-4">
              {permission === "denied" ? (
                <p className="text-sm text-muted-foreground">
                  Browser notifications are blocked. Please enable them in your browser settings.
                </p>
              ) : isSubscribed ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Browser notifications are enabled
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrowserSubscribe}
                    disabled={isPushLoading}
                  >
                    Disable
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Click to enable browser push notifications
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBrowserSubscribe}
                    disabled={isPushLoading}
                  >
                    {isPushLoading ? "Enabling..." : "Enable Push"}
                  </Button>
                </div>
              )}
              {pushError && (
                <p className="text-sm text-red-600 mt-2">{pushError}</p>
              )}
            </div>
          )}

          {!isSupported && (
            <p className="text-sm text-muted-foreground border-t pt-4">
              Browser push notifications are not supported in your browser.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Receive notifications via email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Get important notifications delivered to your inbox
              </p>
            </div>
            <Checkbox
              id="email-enabled"
              checked={preferences.email_enabled}
              onCheckedChange={() => handleToggle("email_enabled")}
              disabled={isPending || !preferences.notifications_enabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Event Types</CardTitle>
          <CardDescription>
            Choose which events trigger notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="size-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="event-comment">Comments on Assigned Content</Label>
                <p className="text-sm text-muted-foreground">
                  When someone comments on content you're assigned to
                </p>
              </div>
            </div>
            <Checkbox
              id="event-comment"
              checked={preferences.event_preferences.comment_on_assigned}
              onCheckedChange={() => handleEventToggle("comment_on_assigned")}
              disabled={isPending || !preferences.notifications_enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AtSign className="size-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="event-mention">Mentions</Label>
                <p className="text-sm text-muted-foreground">
                  When someone @mentions you in a comment
                </p>
              </div>
            </div>
            <Checkbox
              id="event-mention"
              checked={preferences.event_preferences.mention}
              onCheckedChange={() => handleEventToggle("mention")}
              disabled={isPending || !preferences.notifications_enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserPlus className="size-5 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="event-assignment">Assignments</Label>
                <p className="text-sm text-muted-foreground">
                  When you're assigned to content
                </p>
              </div>
            </div>
            <Checkbox
              id="event-assignment"
              checked={preferences.event_preferences.assignment}
              onCheckedChange={() => handleEventToggle("assignment")}
              disabled={isPending || !preferences.notifications_enabled}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
