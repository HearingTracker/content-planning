import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user?.id)
    .single();

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
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Email</label>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <p className="text-sm text-muted-foreground capitalize">
              {userRole?.role || "author"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">User ID</label>
            <p className="text-sm text-muted-foreground font-mono">{user?.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
