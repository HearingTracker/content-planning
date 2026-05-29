-- Durable notification delivery state
-- ---------------------------------------------------------------------------
-- Assignment outbox rows now track the in-app notification and email delivery
-- separately. This lets the flush cron retry a failed email without creating a
-- duplicate in-app notification.

ALTER TABLE public.cp_notification_outbox
  ADD COLUMN notification_id BIGINT REFERENCES public.notifications(id) ON DELETE SET NULL,
  ADD COLUMN email_sent_at TIMESTAMPTZ,
  ADD COLUMN email_message_id TEXT,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_error TEXT;

CREATE INDEX idx_cp_notification_outbox_notification_id
  ON public.cp_notification_outbox (notification_id)
  WHERE notification_id IS NOT NULL;

-- One digest per user per Eastern calendar day. RLS has no policies because
-- only the service-role cron reads/writes this ledger.
CREATE TABLE public.cp_daily_digest_deliveries (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  digest_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed')),
  item_count INTEGER NOT NULL DEFAULT 0,
  message_id TEXT,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, digest_date)
);

CREATE INDEX idx_cp_daily_digest_deliveries_date_status
  ON public.cp_daily_digest_deliveries (digest_date, status);

ALTER TABLE public.cp_daily_digest_deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.cp_daily_digest_deliveries
  TO service_role;
