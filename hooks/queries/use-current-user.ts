"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "admin" | "editor" | "author";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: Infinity, // User doesn't change during session
  });
}

export function useCurrentUserRole() {
  return useQuery({
    queryKey: ["currentUserRole"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      return (data?.role as UserRole) || "author";
    },
    staleTime: Infinity, // Role doesn't change during session
  });
}

export function useCanDelete() {
  const { data: role } = useCurrentUserRole();
  return role === "admin" || role === "editor";
}
