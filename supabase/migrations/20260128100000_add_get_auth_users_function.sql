-- Function to get auth users (for Trello import mapping)
CREATE OR REPLACE FUNCTION get_auth_users()
RETURNS TABLE (id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth
AS $$
  SELECT id, email FROM auth.users;
$$;
