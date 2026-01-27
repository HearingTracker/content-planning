import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/sidebar";
import { PageHeader } from "@/components/page-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getUnreadCount } from "@/lib/notifications/actions";
import { getNotificationPreferences } from "@/app/(dashboard)/settings/notifications/actions";
import { QueryProvider } from "./providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user role, profile, and notification state in parallel
  const [userRoleResult, profileResult, unreadCount, notificationPrefs] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id).single(),
    supabase.from("user_profiles").select("display_name, avatar_url").eq("id", user.id).single(),
    getUnreadCount(),
    getNotificationPreferences(),
  ]);

  const userRole = userRoleResult.data;
  const profile = profileResult.data;
  const isMuted = !(notificationPrefs?.notifications_enabled ?? true);

  // Get sidebar state from cookie
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <QueryProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar
          user={user}
          role={userRole?.role || "author"}
          profile={profile || undefined}
        />
        <SidebarInset>
          <PageHeader userId={user.id} initialUnreadCount={unreadCount} initialIsMuted={isMuted} />
          <main className="flex-1 min-w-0 overflow-auto bg-muted/30 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
