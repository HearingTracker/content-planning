-- Notification outbox: debounced delivery queue for assignment notifications.
-- ---------------------------------------------------------------------------
-- When a user is assigned to a content item we don't notify immediately --
-- the creator may still be setting the item up (editing the title, adding or
-- removing assignees). Instead we enqueue a pending row with a `send_after`
-- timestamp and let a frequent cron (/api/cron/flush-notifications) replay the
-- notification once the debounce window has passed, against the *current* state
-- of the assignment. Only the service-role (admin) client touches this table.

CREATE TABLE public.cp_notification_outbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id BIGINT NOT NULL REFERENCES public.cp_content(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role VARCHAR(20) NOT NULL,
  send_after TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One pending row per (recipient, item): re-adding an assignee replaces the
-- pending row and bumps send_after, which gives us the debounce behaviour.
CREATE UNIQUE INDEX idx_cp_notification_outbox_pending_unique
  ON public.cp_notification_outbox (recipient_id, content_id)
  WHERE sent_at IS NULL;

-- Flush query: due, not-yet-sent rows.
CREATE INDEX idx_cp_notification_outbox_due
  ON public.cp_notification_outbox (send_after)
  WHERE sent_at IS NULL;

-- RLS on with no policies: anon/authenticated get no access. The service-role
-- client (createAdminClient) bypasses RLS and is the only caller.
ALTER TABLE public.cp_notification_outbox ENABLE ROW LEVEL SECURITY;

-- The explicit Data API grants migration (20260529010927) revoked default
-- privileges for objects created after it, so service_role must be granted
-- access to this new table/sequence explicitly.
GRANT ALL PRIVILEGES ON TABLE public.cp_notification_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.cp_notification_outbox_id_seq TO service_role;
