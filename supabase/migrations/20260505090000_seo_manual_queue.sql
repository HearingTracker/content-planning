-- Manual SEO queue
-- ---------------------------------------------------------------------------
-- Automated SEO findings are intentionally sync-owned: the next GSC/SERP sync
-- can update, archive, or reclassify them. This table gives editors a separate
-- queue for work the automated system cannot reliably discover, such as news,
-- product testing, pricing changes, first-hand feedback, regulatory events, or
-- reopening a monitor/do-nothing recommendation for human judgment.

CREATE TABLE public.cp_seo_manual_queue_items (
  id                          bigserial PRIMARY KEY,

  task_type                   text NOT NULL CHECK (
    task_type IN ('article_update', 'update_event', 'manual_article', 'reopen_monitor')
  ),
  page                        text,
  target_title                text,
  summary                     text NOT NULL,
  evidence                    text,
  source_url                  text,
  event_date                  date,
  priority                    text NOT NULL DEFAULT 'medium' CHECK (
    priority IN ('low', 'medium', 'high', 'urgent')
  ),
  status                      public.cp_seo_opp_status NOT NULL DEFAULT 'open',

  linked_opportunity_id       bigint REFERENCES public.cp_seo_opportunities(id) ON DELETE SET NULL,
  linked_synthesis_finding_id bigint REFERENCES public.cp_seo_synthesis_findings(id) ON DELETE SET NULL,
  assigned_to                 uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  archived_at                 timestamptz,

  CONSTRAINT cp_seo_manual_queue_has_target
    CHECK (page IS NOT NULL OR target_title IS NOT NULL)
);

COMMENT ON TABLE public.cp_seo_manual_queue_items IS
  'Editor-created SEO work items for update-worthy events or articles the automated /seo pipeline cannot safely infer.';
COMMENT ON COLUMN public.cp_seo_manual_queue_items.task_type IS
  'article_update = update an existing article; update_event = news/testing/price/regulatory event; manual_article = manually queue an article; reopen_monitor = human override for monitor/do-nothing recommendations.';
COMMENT ON COLUMN public.cp_seo_manual_queue_items.summary IS
  'Short editor-facing reason this item should be in the SEO queue.';
COMMENT ON COLUMN public.cp_seo_manual_queue_items.evidence IS
  'Optional notes: source context, testing data, feedback summary, fact-checking needs, formatting requirements.';

CREATE INDEX idx_seo_manual_queue_status_priority
  ON public.cp_seo_manual_queue_items (status, priority, created_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX idx_seo_manual_queue_page
  ON public.cp_seo_manual_queue_items (page)
  WHERE archived_at IS NULL AND page IS NOT NULL;

CREATE INDEX idx_seo_manual_queue_created
  ON public.cp_seo_manual_queue_items (created_at DESC)
  WHERE archived_at IS NULL;

CREATE TRIGGER cp_seo_manual_queue_items_updated_at
  BEFORE UPDATE ON public.cp_seo_manual_queue_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.cp_seo_manual_queue_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read manual seo queue"
  ON public.cp_seo_manual_queue_items FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "editor insert manual seo queue"
  ON public.cp_seo_manual_queue_items FOR INSERT
  TO authenticated
  WITH CHECK (public.cp_user_is_editor_or_above());

CREATE POLICY "editor update manual seo queue"
  ON public.cp_seo_manual_queue_items FOR UPDATE
  TO authenticated
  USING (public.cp_user_is_editor_or_above())
  WITH CHECK (public.cp_user_is_editor_or_above());
