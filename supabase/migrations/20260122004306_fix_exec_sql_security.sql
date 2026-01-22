-- Fix exec_sql function security issue: mutable search_path
-- WARNING: This function allows arbitrary SQL execution and should be reviewed
-- Consider dropping it if not actively used

-- Option 1: Fix the search_path (current approach)
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  EXECUTE sql;
END;
$function$;

-- Revoke execute from public - only allow service_role/postgres
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.exec_sql(text) FROM authenticated;

-- Option 2 (alternative): Drop the function entirely if not needed
-- Uncomment the line below to drop instead of fixing:
-- DROP FUNCTION IF EXISTS public.exec_sql(text);
