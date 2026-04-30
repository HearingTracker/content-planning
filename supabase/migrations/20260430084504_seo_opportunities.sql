-- SEO Low-Hanging Fruit dashboard
-- ────────────────────────────────────────────────────────────────────────────
-- cp_seo_pages          — one row per revenue-generating page
-- cp_seo_opportunities  — one row per (page, query); user state preserved
--                         across nightly cron via cp_seo_upsert_opportunities()

CREATE TYPE public.cp_seo_opp_status AS ENUM ('open', 'in_progress', 'done', 'dismissed');
CREATE TYPE public.cp_seo_opp_kind   AS ENUM ('primary', 'supporting', 'secondary');

CREATE TABLE public.cp_seo_pages (
  page                 text PRIMARY KEY,
  page_title           text,
  meta_source          text,
  earnings_90d         numeric(10,2) NOT NULL DEFAULT 0,
  conversions_90d      integer       NOT NULL DEFAULT 0,
  open_opportunities   integer       NOT NULL DEFAULT 0,
  last_synced_at       timestamptz   NOT NULL DEFAULT now(),
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE public.cp_seo_opportunities (
  id                   bigserial PRIMARY KEY,
  page                 text NOT NULL REFERENCES public.cp_seo_pages(page) ON DELETE CASCADE,
  query                text NOT NULL,
  kind                 public.cp_seo_opp_kind NOT NULL,
  novel_tokens         text,
  position             numeric(4,1),
  impressions          integer,
  clicks               integer,
  ctr_pct              numeric(5,2),
  expected_ctr_pct     numeric(5,2),
  kd                   integer,
  volume               integer,
  traffic_potential    integer,
  parent_topic         text,
  intents              text,
  serp_features        text,
  phrase_in_body       integer NOT NULL DEFAULT 0,
  in_heading           boolean NOT NULL DEFAULT false,
  score                integer NOT NULL DEFAULT 0,

  -- User-editable; preserved across cron runs.
  status               public.cp_seo_opp_status NOT NULL DEFAULT 'open',
  assigned_to          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes                text,

  -- Sync bookkeeping.
  first_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now(),
  archived_at          timestamptz,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cp_seo_opportunities_page_query_uniq UNIQUE (page, query)
);

CREATE INDEX idx_seo_opps_page    ON public.cp_seo_opportunities(page);
CREATE INDEX idx_seo_opps_status  ON public.cp_seo_opportunities(status) WHERE archived_at IS NULL;
CREATE INDEX idx_seo_opps_score   ON public.cp_seo_opportunities(score DESC) WHERE status = 'open' AND archived_at IS NULL;
CREATE INDEX idx_seo_opps_kind    ON public.cp_seo_opportunities(kind);

-- updated_at maintenance using existing public.handle_updated_at() helper
CREATE TRIGGER cp_seo_pages_updated_at
  BEFORE UPDATE ON public.cp_seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER cp_seo_opportunities_updated_at
  BEFORE UPDATE ON public.cp_seo_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- Reads: any authenticated user. Writes via Postgres: editor+. The cron uses
-- service role to bypass RLS for full upserts; the dashboard server actions
-- only ever update status/assigned_to/notes (enforced in the action layer).
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.cp_seo_pages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cp_seo_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read pages"
  ON public.cp_seo_pages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "auth read opportunities"
  ON public.cp_seo_opportunities FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "editor update opportunities"
  ON public.cp_seo_opportunities FOR UPDATE
  TO authenticated
  USING (public.cp_user_is_editor_or_above())
  WITH CHECK (public.cp_user_is_editor_or_above());

-- ────────────────────────────────────────────────────────────────────────────
-- Helper RPCs called by the cron route
-- ────────────────────────────────────────────────────────────────────────────

-- Upsert opportunities, preserving user state on conflict.
-- rows is a JSONB array of opportunity payloads. sync_at is set as last_seen_at.
CREATE OR REPLACE FUNCTION public.cp_seo_upsert_opportunities(
  rows    jsonb,
  sync_at timestamptz
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO public.cp_seo_opportunities (
    page, query, kind, novel_tokens, position, impressions, clicks,
    ctr_pct, expected_ctr_pct, kd, volume, traffic_potential,
    parent_topic, intents, serp_features, phrase_in_body, in_heading, score,
    last_seen_at
  )
  SELECT
    r->>'page',
    r->>'query',
    (r->>'kind')::public.cp_seo_opp_kind,
    r->>'novel_tokens',
    NULLIF(r->>'position', '')::numeric,
    NULLIF(r->>'impressions', '')::integer,
    NULLIF(r->>'clicks', '')::integer,
    NULLIF(r->>'ctr_pct', '')::numeric,
    NULLIF(r->>'expected_ctr_pct', '')::numeric,
    NULLIF(r->>'kd', '')::integer,
    NULLIF(r->>'volume', '')::integer,
    NULLIF(r->>'traffic_potential', '')::integer,
    r->>'parent_topic',
    r->>'intents',
    r->>'serp_features',
    COALESCE(NULLIF(r->>'phrase_in_body', '')::integer, 0),
    COALESCE((r->>'in_heading')::boolean, false),
    COALESCE(NULLIF(r->>'score', '')::integer, 0),
    sync_at
  FROM jsonb_array_elements(rows) AS r
  ON CONFLICT (page, query) DO UPDATE SET
    kind              = EXCLUDED.kind,
    novel_tokens      = EXCLUDED.novel_tokens,
    position          = EXCLUDED.position,
    impressions       = EXCLUDED.impressions,
    clicks            = EXCLUDED.clicks,
    ctr_pct           = EXCLUDED.ctr_pct,
    expected_ctr_pct  = EXCLUDED.expected_ctr_pct,
    kd                = EXCLUDED.kd,
    volume            = EXCLUDED.volume,
    traffic_potential = EXCLUDED.traffic_potential,
    parent_topic      = EXCLUDED.parent_topic,
    intents           = EXCLUDED.intents,
    serp_features     = EXCLUDED.serp_features,
    phrase_in_body    = EXCLUDED.phrase_in_body,
    in_heading        = EXCLUDED.in_heading,
    score             = EXCLUDED.score,
    last_seen_at      = EXCLUDED.last_seen_at,
    archived_at       = NULL;
    -- status / assigned_to / notes are intentionally NOT touched.

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.cp_seo_upsert_opportunities(jsonb, timestamptz) FROM public, anon, authenticated;
-- service_role bypasses GRANTs; the cron uses the service client.

-- Refresh the denormalized open_opportunities counter on cp_seo_pages.
CREATE OR REPLACE FUNCTION public.cp_seo_refresh_open_counts()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.cp_seo_pages p
     SET open_opportunities = COALESCE(c.cnt, 0)
    FROM (
      SELECT pp.page, COALESCE(o.cnt, 0)::integer AS cnt
        FROM public.cp_seo_pages pp
        LEFT JOIN (
          SELECT page, count(*) AS cnt
            FROM public.cp_seo_opportunities
           WHERE status = 'open' AND archived_at IS NULL
           GROUP BY page
        ) o ON o.page = pp.page
    ) c
   WHERE c.page = p.page;
$$;

REVOKE ALL ON FUNCTION public.cp_seo_refresh_open_counts() FROM public, anon, authenticated;
