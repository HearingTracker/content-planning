-- Allow editors (and above) to delete pitches, briefs, and campaigns

-- Pitches (cp_content_ideas)
DROP POLICY IF EXISTS "Admins can delete content ideas" ON cp_content_ideas;
CREATE POLICY "Editors can delete content ideas"
  ON cp_content_ideas
  FOR DELETE
  TO authenticated
  USING (cp_user_is_editor_or_above());

-- Briefs (cp_content_briefs)
DROP POLICY IF EXISTS "Admins can delete content briefs" ON cp_content_briefs;
CREATE POLICY "Editors can delete content briefs"
  ON cp_content_briefs
  FOR DELETE
  TO authenticated
  USING (cp_user_is_editor_or_above());

-- Campaigns (cp_campaigns)
DROP POLICY IF EXISTS "Admins can delete campaigns" ON cp_campaigns;
CREATE POLICY "Editors can delete campaigns"
  ON cp_campaigns
  FOR DELETE
  TO authenticated
  USING (cp_user_is_editor_or_above());
