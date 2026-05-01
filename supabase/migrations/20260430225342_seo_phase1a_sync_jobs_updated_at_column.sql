-- Phase 1A fix: cp_seo_sync_jobs trigger expects an updated_at column.
-- The kinds_and_jobs migration added the trigger but forgot the column,
-- causing the first sync to fail with: record "new" has no field "updated_at".

ALTER TABLE public.cp_seo_sync_jobs
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
