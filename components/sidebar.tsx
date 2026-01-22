"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  FileText,
  Lightbulb,
  Settings,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(auth)/login/actions";
import type { UserRole } from "@/lib/types";

interface SidebarProps {
  user: User;
  role: UserRole;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Content", href: "/content", icon: FileText },
  { name: "Strategy", href: "/strategy", icon: Lightbulb },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Users", href: "/settings/users", icon: Users },
];

export function Sidebar({ user, role }: SidebarProps) {
  const pathname = usePathname();

  const allNavigation =
    role === "admin" ? [...navigation, ...adminNavigation] : navigation;

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <FileText className="h-5 w-5" />
          <span>Content Planning</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {allNavigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {user.email?.[0].toUpperCase()}
          </div>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
        <form action={logout}>
          <Button variant="ghost" size="sm" className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
