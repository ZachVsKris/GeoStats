-- Only after a complete exact comparison, native query-plan checks and backup.
-- NOWAIT refuses an occupied table. Bound the metadata-only cutover duration.
set local lock_timeout='250ms';
set local statement_timeout='30s';
set local search_path=public,pg_catalog;
lock table public.stat_observations in access exclusive mode nowait;
lock table geostats_maintenance.observations_compact in access exclusive mode nowait;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.stat_observations'::regclass and tgname='mirror_observation_compaction' and not tgisinternal) then
  raise exception 'Observation mirror is not active; keep the original table';
 end if;
 if exists(select 1 from pg_constraint where confrelid='public.stat_observations'::regclass) then
  raise exception 'Incoming foreign key requires a different cutover';
 end if;
 if exists(select 1 from pg_publication_tables where schemaname='public' and tablename='stat_observations') then
  raise exception 'Realtime publication requires a different cutover';
 end if;
end $$;
create temporary table observation_views_to_rebind on commit drop as
select distinct v.oid::regclass::text as name,pg_get_viewdef(v.oid,true) as definition
from pg_depend d join pg_rewrite r on r.oid=d.objid join pg_class v on v.oid=r.ev_class
where d.refobjid='public.stat_observations'::regclass and v.relkind='v';
drop trigger mirror_observation_compaction on public.stat_observations;
alter table public.stat_observations rename to stat_observations_before_compaction;
alter table geostats_maintenance.observations_compact set schema public;
alter table public.observations_compact rename to stat_observations;
do $$ declare v record; begin
 for v in select * from observation_views_to_rebind loop
  execute 'create or replace view '||v.name||' as '||v.definition;
 end loop;
end $$;
-- Any undiscovered dependency aborts the whole transaction; never CASCADE.
drop table public.stat_observations_before_compaction restrict;
alter table public.stat_observations rename constraint observations_compact_pkey to stat_observations_pkey;
alter table public.stat_observations rename constraint observations_compact_category_id_fkey to stat_observations_category_id_fkey;
alter index public.observations_compact_category_year_idx rename to stat_observations_category_year_idx;
alter index public.observations_compact_country_idx rename to stat_observations_country_idx;
alter index public.observations_compact_category_year_country_idx rename to stat_observations_category_year_country_v16_2_5_idx;
alter index public.observations_compact_category_year_value_country_idx rename to stat_observations_category_year_value_country_v16_2_7_idx;
create trigger force_canonical_observation_country_name before insert or update of country_iso3,country_name on public.stat_observations
for each row execute function public.force_canonical_observation_country_name();
grant all on public.stat_observations to anon,authenticated;
grant all on public.stat_observations to service_role;
drop function geostats_maintenance.copy_categories(text[]);
drop function if exists geostats_maintenance.copy_next(integer);
drop function geostats_maintenance.mirror_observation();
drop schema geostats_maintenance restrict;
notify pgrst,'reload schema';
