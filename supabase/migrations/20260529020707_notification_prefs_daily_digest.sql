-- Add the new "daily_digest" event preference (daily outstanding-items email).
-- ---------------------------------------------------------------------------
-- Update the column default for new rows and backfill existing rows so every
-- preferences record carries an explicit boolean. Missing JSONB keys read as
-- enabled in code, but an explicit value keeps the settings UI toggle correct.

ALTER TABLE public.notification_preferences
  ALTER COLUMN event_preferences
  SET DEFAULT '{"comment_on_assigned": true, "mention": true, "assignment": true, "daily_digest": true}'::jsonb;

UPDATE public.notification_preferences
SET event_preferences = event_preferences || '{"daily_digest": true}'::jsonb
WHERE NOT (event_preferences ? 'daily_digest');
