-- Link cp_seo_manual_queue_items rows to a cp_content row when an editor
-- converts an SEO opportunity into a content item. The manual queue is the
-- existing link table between SEO and editorial state, so this is the
-- minimal-blast-radius option (no new column on cp_seo_opportunities, no
-- new join surface for the SEO drilldown).
--
-- Cascade is SET NULL on delete: if a content item is later deleted, the
-- queue row should remain (the SEO opportunity context is still valid) but
-- the link is cleared so the UI doesn't dereference a missing row.

ALTER TABLE public.cp_seo_manual_queue_items
  ADD COLUMN linked_content_item_id bigint
    REFERENCES public.cp_content(id)
    ON DELETE SET NULL;

CREATE INDEX idx_seo_manual_queue_linked_content_item
  ON public.cp_seo_manual_queue_items (linked_content_item_id)
  WHERE linked_content_item_id IS NOT NULL;

-- One active editorial conversion per automated opportunity. This protects
-- against stale tabs / concurrent clicks creating duplicate cp_content rows
-- for the same SEO opportunity.
CREATE UNIQUE INDEX idx_seo_manual_queue_unique_active_linked_opportunity
  ON public.cp_seo_manual_queue_items (linked_opportunity_id)
  WHERE archived_at IS NULL
    AND linked_opportunity_id IS NOT NULL
    AND linked_content_item_id IS NOT NULL;
