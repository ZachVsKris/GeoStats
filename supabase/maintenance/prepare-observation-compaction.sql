-- Additive staging for a lossless physical compaction. Run via apply_migration.
-- Gameplay continues to read the original table until the verified cutover.
set local lock_timeout='1s';
create schema geostats_maintenance;
revoke all on schema geostats_maintenance from public,anon,authenticated;
grant usage on schema geostats_maintenance to service_role;
create table geostats_maintenance.observations_compact
 (like public.stat_observations including defaults including constraints);
alter table geostats_maintenance.observations_compact
 add primary key(category_id,country_iso3,data_year),
 add constraint observations_compact_category_id_fkey foreign key(category_id) references public.stat_categories(id) on delete cascade;
alter table geostats_maintenance.observations_compact enable row level security;
create policy "Public can read observations for enabled categories" on geostats_maintenance.observations_compact for select
 using(exists(select 1 from public.stat_categories c where c.id=observations_compact.category_id and c.enabled));
grant all on geostats_maintenance.observations_compact to service_role;

create function geostats_maintenance.mirror_observation() returns trigger
language plpgsql security invoker set search_path=pg_catalog,geostats_maintenance as $$
begin
 if tg_op='DELETE' then
  delete from geostats_maintenance.observations_compact where (category_id,country_iso3,data_year)=(old.category_id,old.country_iso3,old.data_year);
  return old;
 end if;
 if tg_op='UPDATE' and (old.category_id,old.country_iso3,old.data_year) is distinct from (new.category_id,new.country_iso3,new.data_year) then
  delete from geostats_maintenance.observations_compact where (category_id,country_iso3,data_year)=(old.category_id,old.country_iso3,old.data_year);
 end if;
 insert into geostats_maintenance.observations_compact values(new.*)
 on conflict(category_id,country_iso3,data_year) do update set
 country_name=excluded.country_name,value=excluded.value,source_url=excluded.source_url,
 source_record_id=excluded.source_record_id,imported_at=excluded.imported_at,metadata=excluded.metadata;
 return new;
end $$;
revoke all on function geostats_maintenance.mirror_observation() from public,anon,authenticated;
grant execute on function geostats_maintenance.mirror_observation() to service_role;
create trigger mirror_observation_compaction after insert or update or delete on public.stat_observations
for each row execute function geostats_maintenance.mirror_observation();

create function geostats_maintenance.copy_categories(p_categories text[]) returns bigint
language plpgsql security invoker set search_path=pg_catalog,geostats_maintenance as $$
declare n bigint;
begin
 -- SHARE permits gameplay reads and serializes import writes only for this batch.
 -- The mirror trigger covers subsequent writes, including newly inserted categories.
 lock table public.stat_observations in share mode nowait;
 insert into geostats_maintenance.observations_compact
 select * from public.stat_observations where category_id=any(p_categories)
 order by category_id,country_iso3,data_year
 on conflict(category_id,country_iso3,data_year) do nothing;
 get diagnostics n=row_count;
 if exists(
 (select * from public.stat_observations where category_id=any(p_categories)
 except all select * from geostats_maintenance.observations_compact where category_id=any(p_categories))
 union all
 (select * from geostats_maintenance.observations_compact where category_id=any(p_categories)
 except all select * from public.stat_observations where category_id=any(p_categories))) then
  raise exception 'Compaction batch does not match source data exactly';
 end if;
 return n;
end $$;
revoke all on function geostats_maintenance.copy_categories(text[]) from public,anon,authenticated;
grant execute on function geostats_maintenance.copy_categories(text[]) to service_role;
