-- Phase 1B · AI Overview loss diagnosis
-- ────────────────────────────────────────────────────────────────────────────
-- The classifier needs an editorial state for the case where a page ranks
-- well (avg pos ≤8) but the SERP shows an AI Overview AND HearingTracker is
-- NOT cited as an AIO source. The lever in that case isn't a snippet rewrite
-- (the click is being absorbed by the AIO panel before the user sees the
-- organic result) and it isn't a body-coverage gap — it's passage-level GEO:
-- rewrite content for AIO-citation patterns (front-loaded factual answers,
-- structured passages, source-friendly attribution).
--
-- Without this kind, the classifier was forced to pick `snippet_ctr` and
-- emit GEO advice in the prose, which buried the diagnosis under the wrong
-- label and produced overstated "extra clicks within reach" estimates.

INSERT INTO public.cp_seo_opportunity_kinds
  (key, display_label, short_label, action_verb, description, ui_tone, ui_icon, priority_order)
VALUES
  ('ai_overview_loss', 'AI Overview is taking the click', 'AIO',
    'rewrite for AIO citation',
    'Page ranks but the AI Overview is winning the click — passage-level rewrite needed.',
    'amber', 'Bot', 35);
