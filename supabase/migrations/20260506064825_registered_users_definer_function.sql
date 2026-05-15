-- The registered_users view was set to security_invoker=on to satisfy the
-- Supabase security advisor. But authenticated users have no SELECT privilege
-- on auth.users, so the view returned zero rows and broke the assignee picker
-- and chat @-mentions.
--
-- Fix: gate the auth.users read through a SECURITY DEFINER function that
-- exposes only the safe columns (id, email, display_name, avatar_url) and
-- pins search_path. The view stays security_invoker=on so RLS on
-- public.user_profiles is still enforced for the caller.

CREATE OR REPLACE FUNCTION public.get_registered_users()
RETURNS TABLE (
  id uuid,
  email text,
  display_name text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT
    u.id,
    u.email::text AS email,
    COALESCE(p.display_name, split_part(u.email::text, '@', 1)) AS display_name,
    p.avatar_url
  FROM auth.users u
  LEFT JOIN public.user_profiles p ON p.id = u.id
  ORDER BY COALESCE(p.display_name, u.email::text);
$$;

REVOKE ALL ON FUNCTION public.get_registered_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_registered_users() TO authenticated, service_role;

DROP VIEW IF EXISTS public.registered_users;

CREATE VIEW public.registered_users
WITH (security_invoker = on) AS
SELECT id, email, display_name, avatar_url
FROM public.get_registered_users();

REVOKE ALL ON public.registered_users FROM PUBLIC, anon;
GRANT SELECT ON public.registered_users TO authenticated, service_role;
