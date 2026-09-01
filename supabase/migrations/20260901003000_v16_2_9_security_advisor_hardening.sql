begin;

-- These review/catalog views are administrative surfaces. Make their access
-- obey the querying role instead of inheriting the view owner's privileges.
alter view public.stat_latest_values set (security_invoker=true);
alter view public.category_catalog_review_v15_5 set (security_invoker=true);
alter view public.category_copy_clarity_v16_2_8 set (security_invoker=true);
alter view public.category_release_targets_status_v16_2_5 set (security_invoker=true);

-- Legacy setup, repair, and refresh functions must never be callable through
-- the anonymous or signed-in PostgREST roles. Database triggers can still run
-- their trigger functions; production maintenance uses service_role.
revoke all on function public.apply_category_catalog_editorial_v15_5() from public,anon,authenticated;
revoke all on function public.ensure_category_catalog_editorial_v15_5() from public,anon,authenticated;
revoke all on function public.ensure_category_review_state_v15() from public,anon,authenticated;
revoke all on function public.force_canonical_observation_country_name() from public,anon,authenticated;
revoke all on function public.handle_new_user() from public,anon,authenticated;
revoke all on function public.refresh_canonical_after_source_change() from public,anon,authenticated;
revoke all on function public.refresh_canonical_preferred_source(uuid) from public,anon,authenticated;
revoke all on function public.source_integrity_is_enforced() from public,anon,authenticated;

grant execute on function public.apply_category_catalog_editorial_v15_5() to service_role;
grant execute on function public.ensure_category_catalog_editorial_v15_5() to service_role;
grant execute on function public.ensure_category_review_state_v15() to service_role;
grant execute on function public.force_canonical_observation_country_name() to service_role;
grant execute on function public.refresh_canonical_after_source_change() to service_role;
grant execute on function public.refresh_canonical_preferred_source(uuid) to service_role;
grant execute on function public.source_integrity_is_enforced() to service_role;

commit;
