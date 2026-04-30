"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { NotificationBell } from "@/components/notifications/notification-bell";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/products": "Products",
  "/content": "Content",
  "/strategy": "Strategy",
  "/settings": "Settings",
  "/settings/users": "User Management",
  "/settings/notifications": "Notification Settings",
  "/seo": "SEO Opportunities",
};

interface PageHeaderProps {
  userId: string;
  initialUnreadCount?: number;
  initialIsMuted?: boolean;
}

export function PageHeader({
  userId,
  initialUnreadCount = 0,
  initialIsMuted = false,
}: PageHeaderProps) {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <NotificationBell
        userId={userId}
        initialUnreadCount={initialUnreadCount}
        initialIsMuted={initialIsMuted}
      />
    </header>
  );
}
