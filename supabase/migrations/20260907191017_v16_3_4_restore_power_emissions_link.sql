begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.3.4-power-emissions-link'));

-- This category already has a verified source snapshot, complete winning end,
-- and successful proof in all three Daily solvers. A transient URL timeout must
-- not overturn that evidence when the stored player link is the exact official
-- World Bank indicator page.
update public.stat_categories
set player_source_status='exact',
    player_source_reason='Exact official World Bank indicator page for EN.GHG.CO2.PI.MT.CE.AR5; the earlier live-link timeout was non-substantive.',
    player_source_checked_at=now(),
    content_review_status='approved',
    content_review_reason='v16.3.4 verified official player-source recovery for the power-generation CO₂ measure.',
    content_review_version='geostats-v16.3.4-catalog-recovery',
    updated_at=now()
where id='worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5'
  and source_organization='World Bank'
  and source_indicator_code='EN.GHG.CO2.PI.MT.CE.AR5'
  and player_source_url='https://data.worldbank.org/indicator/EN.GHG.CO2.PI.MT.CE.AR5'
  and validation_status='verified'
  and coalesce(validation_mismatch_count,0)=0
  and coalesce(validation_ranking_mismatch_count,0)=0;

select public.refresh_v16_2_runtime_catalog();

do $$
begin
  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5'
      and player_source_status='exact'
      and computed_playable_v16_2 and enabled and eligible_daily
  ) then raise exception 'v16.3.4 could not restore verified power-generation CO₂ category'; end if;

  if (select release_ready_categories from public.assert_v16_3_4_runtime_catalog())<>318 then
    raise exception 'v16.3.4 expected 318 release-ready categories after official-link recovery';
  end if;
end $$;

commit;
