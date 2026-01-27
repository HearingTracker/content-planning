-- Allow editors (and above) to delete content items, not just admins
DROP POLICY IF EXISTS "Admins can delete content items" ON cp_content_items;

CREATE POLICY "Editors can delete content items"
  ON cp_content_items
  FOR DELETE
  TO authenticated
  USING (cp_user_is_editor_or_above());
