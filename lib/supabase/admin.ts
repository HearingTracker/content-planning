import { createClient } from "@supabase/supabase-js";

/**
 * Create an admin Supabase client without cookies (for background tasks).
 * Uses the service role key to bypass RLS.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Get a user's email address from Supabase Auth.
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    console.error("[Admin] Error fetching user:", error);
    return null;
  }

  return data.user.email || null;
}

/**
 * Get email addresses for multiple users.
 */
export async function getUserEmails(
  userIds: string[]
): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();

  await Promise.all(
    userIds.map(async (userId) => {
      const email = await getUserEmail(userId);
      if (email) {
        emailMap.set(userId, email);
      }
    })
  );

  return emailMap;
}
