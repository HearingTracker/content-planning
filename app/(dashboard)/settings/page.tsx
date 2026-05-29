import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./components/profile-form";
import { getProfile } from "./actions";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profile, userRoleResult] = await Promise.all([
    getProfile(),
    supabase.from("user_roles").select("role").eq("user_id", user?.id).single(),
  ]);

  const userRole = userRoleResult.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Update your profile information and avatar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile && user?.email && (
            <ProfileForm profile={profile} email={user.email} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Manage browser, email, assignment, comment, and daily digest notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/settings/notifications">
              <Bell className="size-4" />
              Notifications
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Role</label>
            <p className="text-sm text-muted-foreground capitalize">
              {userRole?.role || "author"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">User ID</label>
            <p className="text-sm text-muted-foreground font-mono text-xs">
              {user?.id}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
