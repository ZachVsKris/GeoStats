-- GeoStats v14.4 rollback of database objects only.
-- This intentionally does not restore v14.3.1's exact-link trigger because that
-- trigger silently disabled approved categories and caused the Daily pool loss.
begin;
drop view if exists public.category_content_link_issues;
drop view if exists public.category_content_link_overview;
drop view if exists public.category_v144_overview;
drop view if exists public.stat_observation_integrity_v144;
drop view if exists public.category_playability_v144;
drop function if exists public.reconcile_category_playability_v144();
drop function if exists public.general_official_source_page(text);
commit;
