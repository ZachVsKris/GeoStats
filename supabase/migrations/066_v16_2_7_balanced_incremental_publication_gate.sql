begin;

-- Publish audited breadth in useful increments. The original v16.2.7 gate tied
-- every release to a future 500-category target and two named sports measures,
-- which prevented a fully audited, materially broader catalog from shipping.
-- Keep the hard quality/reachability invariants, but evaluate breadth across the
-- whole knowledge mix instead of making one source or sport release-critical.
create or replace function public.assert_v16_2_7_release()
returns table(playable integer,unreachable_checks integer,unproved_categories integer,duplicate_titles integer)
language plpgsql
security definer
set search_path=public
as $$
declare
  p integer;
  bad integer;
  unproved integer;
  dups integer;
  history_n integer;
  culture_n integer;
  physical_n integer;
  concentrated_n integer;
  macro_n integer;
begin
  select count(*) into p
  from public.category_runtime_review_v16_2
  where computed_playable_v16_2;

  select
    count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)='history'),
    count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata)='culture-language-religion'),
    count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata) in ('physical-geography','geology-natural-hazards')),
    count(*) filter(where public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata) in ('economy-finance','trade','food-agriculture')),
    count(distinct public.category_macro_domain_v16_2_7(c.family,c.source_organization,c.title,c.metadata))
  into history_n,culture_n,physical_n,concentrated_n,macro_n
  from public.stat_categories c
  join public.category_runtime_review_v16_2 v on v.id=c.id
  where v.computed_playable_v16_2;

  select count(*) into bad
  from public.generator_reachability_v16_2_7 r
  join public.category_runtime_review_v16_2 v on v.id=r.category_id
  where v.computed_playable_v16_2 and not r.reachable;

  select count(*) into unproved
  from public.category_runtime_review_v16_2 v
  where v.computed_playable_v16_2
    and not exists(
      select 1
      from public.generator_reachability_v16_2_7 r
      where r.category_id=v.id
      group by r.category_id
      having bool_and(r.reachable) and count(*)=3
    );

  select count(*) into dups
  from (
    select regexp_replace(lower(trim(title)),'[^a-z0-9]+','','g') k,count(*) n
    from public.category_runtime_review_v16_2
    where computed_playable_v16_2
    group by 1
    having count(*)>1
  ) q;

  if p<325 then
    raise exception 'v16.2.7 publication blocked: only % playable categories; the incremental breadth floor is 325.',p;
  end if;
  if macro_n<12 then
    raise exception 'v16.2.7 publication blocked: only % macro knowledge domains are represented; at least 12 are required.',macro_n;
  end if;
  if history_n<5 then
    raise exception 'v16.2.7 publication blocked: only % playable history categories; at least 5 are required.',history_n;
  end if;
  if culture_n<15 then
    raise exception 'v16.2.7 publication blocked: only % playable culture/language/religion categories; at least 15 are required.',culture_n;
  end if;
  if physical_n<20 then
    raise exception 'v16.2.7 publication blocked: only % playable physical-geography/geology/hazard categories; at least 20 are required.',physical_n;
  end if;
  if concentrated_n::numeric/nullif(p,0)>0.63 then
    raise exception 'v16.2.7 publication blocked: economy/trade/agriculture are % of the playable catalog; maximum is 63%%.',round(100.0*concentrated_n/nullif(p,0),1);
  end if;
  if bad<>0 then
    raise exception 'v16.2.7 publication blocked: % production-solver reachability checks fail.',bad;
  end if;
  if unproved<>0 then
    raise exception 'v16.2.7 publication blocked: % playable categories lack all-mode production-solver reachability proof.',unproved;
  end if;
  if dups<>0 then
    raise exception 'v16.2.7 publication blocked: % exact playable title duplicates remain.',dups;
  end if;

  return query select p,bad,unproved,dups;
end;
$$;

revoke all on function public.assert_v16_2_7_release() from public,anon,authenticated;
grant execute on function public.assert_v16_2_7_release() to service_role;

commit;
