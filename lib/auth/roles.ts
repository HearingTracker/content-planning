import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export async function getUserRole(userId: string): Promise<UserRole | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  return (data?.role as UserRole) || null;
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return getUserRole(user.id);
}

export async function setUserRole(
  userId: string,
  role: UserRole
): Promise<{ error: string | null }> {
  const serviceClient = await createServiceClient();
  const { error } = await serviceClient.from("user_roles").upsert(
    {
      user_id: userId,
      role,
    },
    {
      onConflict: "user_id",
    }
  );

  return { error: error?.message || null };
}

export async function isAdmin(userId?: string): Promise<boolean> {
  if (!userId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) return false;

  const role = await getUserRole(userId);
  return role === "admin";
}

export async function isEditorOrAbove(userId?: string): Promise<boolean> {
  if (!userId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id;
  }

  if (!userId) return false;

  const role = await getUserRole(userId);
  return role === "admin" || role === "editor";
}

export async function requireRole(
  requiredRole: UserRole
): Promise<{ authorized: boolean; role: UserRole | null }> {
  const role = await getCurrentUserRole();

  if (!role) {
    return { authorized: false, role: null };
  }

  const roleHierarchy: Record<UserRole, number> = {
    admin: 3,
    editor: 2,
    author: 1,
  };

  const authorized = roleHierarchy[role] >= roleHierarchy[requiredRole];
  return { authorized, role };
}
