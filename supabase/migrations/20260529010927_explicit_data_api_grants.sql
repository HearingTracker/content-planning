-- Explicit Supabase Data API grants
-- ---------------------------------------------------------------------------
-- Supabase is moving away from implicitly exposing new public schema objects
-- through broad default privileges. This migration backfills the current
-- intended API surface, narrows anon/authenticated object grants, and then
-- revokes future default grants so new objects must opt in explicitly.

grant usage on schema public to anon, authenticated, service_role;

-- Remove broad historical Data API reachability for browser roles. RLS still
-- decides row access, but object privileges should be narrow and reviewable.
revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;

-- service_role bypasses RLS but still needs object privileges when used via
-- PostgREST/RPC. Preserve service-role reachability for existing objects.
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

-- Existing public helper/RPC functions should not inherit PostgreSQL's broad
-- PUBLIC execute behavior. Extension functions are intentionally left alone.
revoke execute on function public.exec_sql(text) from public, anon, authenticated;
revoke execute on function public.handle_updated_at() from public, anon, authenticated;
revoke execute on function public.cp_user_has_role(text) from public, anon, authenticated;
revoke execute on function public.cp_user_has_any_role(text[]) from public, anon, authenticated;
revoke execute on function public.cp_user_is_admin() from public, anon, authenticated;
revoke execute on function public.cp_user_is_editor_or_above() from public, anon, authenticated;
revoke execute on function public.cp_user_is_team_member() from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user_role() from public, anon, authenticated;
revoke execute on function public.update_notification_preferences_updated_at() from public, anon, authenticated;
revoke execute on function public.create_default_notification_preferences() from public, anon, authenticated;
revoke execute on function public.get_auth_users() from public, anon, authenticated;
revoke execute on function public.update_cp_content_updated_at() from public, anon, authenticated;
revoke execute on function public.cp_seo_upsert_opportunities(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.cp_seo_refresh_open_counts() from public, anon, authenticated;
revoke execute on function public.cp_seo_sync_all(jsonb, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.get_registered_users() from public, anon;

-- Public catalog objects with existing public read RLS policies.
grant select on table
  public.accessory_tags,
  public.acoustic_profiles,
  public.acoustic_profile_assets,
  public.assets,
  public.authors,
  public.brand_accessories,
  public.brand_accessory_assets,
  public.brand_assets,
  public.brand_hardware_features,
  public.brand_listening_modes,
  public.brand_software_features,
  public.brands,
  public.color_assets,
  public.colors,
  public.coupons,
  public.hardware_features,
  public.ht_ratings,
  public.level_features,
  public.level_listening_modes,
  public.levels,
  public.listening_mode_tags,
  public.model_accessories,
  public.model_assets,
  public.model_features,
  public.model_tags,
  public.models,
  public.offer_coupons,
  public.offers,
  public.product_assets,
  public.products,
  public.published_stories,
  public.redirects,
  public.release_assets,
  public.release_features,
  public.release_tags,
  public.releases,
  public.seller_assets,
  public.sellers,
  public.software_features,
  public.stories,
  public.styles
to anon, authenticated;

-- Dashboard product UI reads this table today. It has no public row policy,
-- so this grant avoids permission errors without changing row visibility.
grant select on table public.evaluations to authenticated;

-- Authenticated content-planning tables. RLS policies remain the authority for
-- which users can perform each operation.
grant select, insert, update, delete on table
  public.user_roles,
  public.product_segments,
  public.cp_workflow_statuses,
  public.cp_content_types,
  public.cp_tags,
  public.cp_campaigns,
  public.cp_content_tags,
  public.cp_author_assignments,
  public.cp_workflow_transitions,
  public.cp_comments,
  public.cp_calendar_events,
  public.cp_content_analytics,
  public.cp_content_assignments,
  public.cp_content_attachments,
  public.cp_content_links,
  public.cp_comment_attachments,
  public.cp_best_list_products,
  public.cp_content
to authenticated;

grant select, insert, update on table
  public.user_profiles,
  public.notification_preferences,
  public.notifications
to authenticated;

grant select, insert, update, delete on table
  public.push_subscriptions
to authenticated;

grant usage, select on sequence
  public.cp_workflow_statuses_id_seq,
  public.cp_content_types_id_seq,
  public.cp_tags_id_seq,
  public.cp_campaigns_id_seq,
  public.cp_content_tags_id_seq,
  public.cp_author_assignments_id_seq,
  public.cp_workflow_transitions_id_seq,
  public.cp_comments_id_seq,
  public.cp_calendar_events_id_seq,
  public.cp_content_analytics_id_seq,
  public.cp_content_assignments_id_seq,
  public.cp_content_attachments_id_seq,
  public.cp_content_links_id_seq,
  public.cp_comment_attachments_id_seq,
  public.cp_best_list_products_id_seq,
  public.cp_content_id_seq,
  public.notifications_id_seq,
  public.push_subscriptions_id_seq
to authenticated;

-- Authenticated views.
grant select on table
  public.cp_calendar_view,
  public.cp_author_workload,
  public.cp_content_pipeline,
  public.cp_campaign_summary,
  public.registered_users,
  public.cp_seo_pages_with_stats
to authenticated;

-- SEO dashboard tables. Writes that are sync-owned stay service-role only.
grant select on table
  public.cp_seo_pages,
  public.cp_seo_query_findings,
  public.cp_seo_keyword_cache,
  public.cp_seo_serp_cache,
  public.cp_seo_synthesis_findings,
  public.cp_seo_rank_history,
  public.cp_seo_question_keyword_cache
to authenticated;

grant select, update on table
  public.cp_seo_opportunities,
  public.cp_seo_clusters
to authenticated;

grant select, insert, update on table
  public.cp_seo_opportunity_kinds,
  public.cp_seo_actions,
  public.cp_seo_synthesis_kinds,
  public.cp_seo_manual_queue_items
to authenticated;

grant select, insert on table
  public.cp_seo_sync_jobs
to authenticated;

grant select on table
  public.cp_seo_user_state_archive_2026_05
to authenticated;

grant usage, select on sequence
  public.cp_seo_actions_id_seq,
  public.cp_seo_manual_queue_items_id_seq,
  public.cp_seo_sync_jobs_id_seq
to authenticated;

-- Helper functions used by RLS policies or authenticated views.
grant execute on function public.cp_user_has_role(text) to authenticated;
grant execute on function public.cp_user_has_any_role(text[]) to authenticated;
grant execute on function public.cp_user_is_admin() to authenticated;
grant execute on function public.cp_user_is_editor_or_above() to authenticated;
grant execute on function public.cp_user_is_team_member() to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.get_registered_users() to authenticated, service_role;

-- Service-only RPCs/functions. get_auth_users() exposes auth.users emails and
-- is only called through the service client by the Trello import.
grant execute on function public.get_auth_users() to service_role;
grant execute on function public.cp_seo_upsert_opportunities(jsonb, timestamptz) to service_role;
grant execute on function public.cp_seo_refresh_open_counts() to service_role;
grant execute on function public.cp_seo_sync_all(jsonb, jsonb, timestamptz) to service_role;
grant execute on function public.exec_sql(text) to service_role;

-- Stop new postgres-created objects from being exposed through defaults.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on functions from anon, authenticated, service_role;

alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated, service_role;

-- Supabase local/hosted tooling commonly creates objects as supabase_admin.
-- Some local migration roles cannot alter another role's defaults, so keep this
-- best-effort instead of failing the whole hardening migration.
do $$
begin
  execute 'alter default privileges for role supabase_admin in schema public revoke all privileges on tables from anon, authenticated, service_role';
  execute 'alter default privileges for role supabase_admin in schema public revoke all privileges on sequences from anon, authenticated, service_role';
  execute 'alter default privileges for role supabase_admin in schema public revoke all privileges on functions from anon, authenticated, service_role';
  execute 'alter default privileges for role supabase_admin revoke execute on functions from public, anon, authenticated, service_role';
exception
  when insufficient_privilege or undefined_object then
    raise notice 'Skipping supabase_admin default privilege revokes: %', sqlerrm;
end;
$$;
