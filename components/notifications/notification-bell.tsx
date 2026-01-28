"use client";

import { useState, useTransition, useCallback } from "react";
import { Bell, BellOff, Check, Settings, VolumeX, Volume2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { getNotifications, markAsRead, markAllAsRead } from "@/lib/notifications/actions";
import { toggleGlobalMute } from "@/app/(dashboard)/settings/notifications/actions";
import { useRealtimeNotifications } from "@/hooks/use-realtime-notifications";
import type { Notification } from "@/lib/notifications/types";

interface NotificationBellProps {
  userId: string;
  initialUnreadCount: number;
  initialIsMuted: boolean;
}

export function NotificationBell({
  userId,
  initialUnreadCount,
  initialIsMuted,
}: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isMuted, setIsMuted] = useState(initialIsMuted);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Handle new realtime notifications
  const handleNewNotification = useCallback((notification: Notification) => {
    if (isMuted) return;

    setUnreadCount((prev) => prev + 1);
    // Add to beginning of list if we've loaded notifications
    if (hasLoadedOnce) {
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
    }
  }, [isMuted, hasLoadedOnce]);

  // Subscribe to realtime notifications
  useRealtimeNotifications({
    userId,
    onNewNotification: handleNewNotification,
  });

  const loadNotifications = async () => {
    if (hasLoadedOnce) return;
    setIsLoading(true);
    const data = await getNotifications(10);
    setNotifications(data);
    setHasLoadedOnce(true);
    setIsLoading(false);
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleGlobalMute();
      if (result.success) {
        setIsMuted(result.isMuted);
      }
    });
  };

  const handleMarkAsRead = (notificationId: number) => {
    startTransition(async () => {
      const result = await markAsRead(notificationId);
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId
              ? { ...n, read_at: new Date().toISOString() }
              : n
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    });
  };

  const handleMarkAllAsRead = () => {
    startTransition(async () => {
      const result = await markAllAsRead();
      if (result.success) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    });
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getNotificationLink = (notification: Notification) => {
    if (!notification.entity_id) return null;

    switch (notification.entity_type) {
      case "content_item": {
        let url = `/content?item=${notification.entity_id}`;
        if (notification.comment_id) {
          url += `&comment=${notification.comment_id}`;
        }
        return url;
      }
      case "content_brief":
        return `/strategy?tab=briefs&brief=${notification.entity_id}`;
      case "content_idea":
        return `/strategy?tab=ideas&idea=${notification.entity_id}`;
      default:
        return null;
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && loadNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            "relative text-muted-foreground",
            isMuted && "text-muted-foreground/50"
          )}
        >
          {isMuted ? (
            <BellOff className="size-4" />
          ) : (
            <Bell className="size-4" />
          )}
          {!isMuted && unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto py-1 px-2 text-xs"
                onClick={handleMarkAllAsRead}
                disabled={isPending}
              >
                <Check className="mr-1 size-3" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6"
              onClick={handleToggleMute}
              disabled={isPending}
              title={isMuted ? "Unmute notifications" : "Mute notifications"}
            >
              {isMuted ? (
                <VolumeX className="size-3.5" />
              ) : (
                <Volume2 className="size-3.5" />
              )}
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => {
                const link = getNotificationLink(notification);
                const isUnread = !notification.read_at;

                return (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "flex flex-col items-start gap-1 p-3 cursor-pointer",
                      isUnread && "bg-accent/50"
                    )}
                    onClick={() => {
                      if (isUnread) {
                        handleMarkAsRead(notification.id);
                      }
                    }}
                    asChild={!!link}
                  >
                    {link ? (
                      <Link href={link}>
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className="font-medium text-sm line-clamp-1">
                            {notification.title}
                          </span>
                          {isUnread && (
                            <span className="size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.body}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </Link>
                    ) : (
                      <>
                        <div className="flex w-full items-start justify-between gap-2">
                          <span className="font-medium text-sm line-clamp-1">
                            {notification.title}
                          </span>
                          {isUnread && (
                            <span className="size-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {notification.body && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {notification.body}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(notification.created_at)}
                        </span>
                      </>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/settings/notifications"
              className="flex items-center justify-center gap-2 text-sm"
            >
              <Settings className="size-4" />
              Notification Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  );
}
