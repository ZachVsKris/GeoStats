-- GeoStats v16.2.2: catalog cleanup, historical categories, measurement-type UI metadata,
-- clearer admin blockers, and permanent Daily publication dependency repair.
--
-- Upgrade migration: run after v16.2.1. Safe to rerun.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.2.2-catalog-upgrade'));

do $$
begin
  if to_regclass('public.category_promotion_assessment_v16_2') is null
     or to_regprocedure('public.assert_v16_2_1_source_recovery()') is null then
    raise exception 'GeoStats v16.2.1 must be installed before v16.2.2.';
  end if;
end $$;

alter table public.stat_categories
  add column if not exists measurement_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='stat_categories_measurement_type_check'
      and conrelid='public.stat_categories'::regclass
  ) then
    alter table public.stat_categories
      add constraint stat_categories_measurement_type_check
      check (measurement_type is null or measurement_type in ('total','share','per_capita','historical_date','other'));
  end if;
end $$;

insert into public.data_sources(id,name,description,status,display_order,metadata)
values
  ('unmembership','United Nations','Official United Nations Member State admission dates.','active',86,
    '{"v16_2_2":"historical","manual_uploads":false}'::jsonb),
  ('constitute','Constitute Project','Current in-force constitution metadata distributed through the Comparative Constitutions Project''s Constitute service.','active',87,
    '{"v16_2_2":"historical","manual_uploads":false}'::jsonb)
on conflict(id) do update set
  name=excluded.name,
  description=excluded.description,
  metadata=coalesce(public.data_sources.metadata,'{}'::jsonb)||excluded.metadata,
  updated_at=now();

create table if not exists public.category_release_decisions_v16_2_2 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  decision text not null check(decision in ('approved','rejected','needs_discussion')),
  rationale text not null,
  applied_at timestamptz not null default now()
);
alter table public.category_release_decisions_v16_2_2 enable row level security;
revoke all on public.category_release_decisions_v16_2_2 from public,anon,authenticated;
grant select on public.category_release_decisions_v16_2_2 to service_role;

insert into public.category_release_decisions_v16_2_2(category_id,decision,rationale)
values
    ('comtrade:most-coal-exported','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('eia:most-crude-oil-produced','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('eia:most-natural-gas-produced','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('natural-earth:highest-coastline-density','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('who:PHE_HHAIR_PROP_POP_CLEAN_FUELS','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:ag-con-fert-pt-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ag-lnd-irig-ag-zs','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:bm-klt-dinv-wd-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:bn-cab-xoka-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:bn-cab-xoka-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','approved','v16.2.2 catalog review: clear, objective country comparison worth keeping; source/integrity gates remain authoritative.'),
    ('worldbank-catalog:cm-mkt-indx-zg','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:cm-mkt-lcap-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:cm-mkt-lcap-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:cm-mkt-ldom-no','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:cm-mkt-trad-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:cm-mkt-trnr','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-ausl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-autl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-bell-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-canl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-cecl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-chel-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-czel-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-deul-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-dnkl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-espl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-estl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-finl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-fral-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-gbrl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-grcl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-hunl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-irll-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-isll-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-ital-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-jpnl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-korl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-ltul-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-luxl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-nldl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-norl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-nzll-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-poll-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-prtl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-svkl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-svnl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-swel-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-totl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-dac-usal-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-oda-tldc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-oda-tldc-gn-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-oda-totl-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dc-oda-totl-kd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dect-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dect-gn-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dimf-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dlxf-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dpng-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dppg-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dstc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dstc-ir-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-dstc-xp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-mibr-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-mida-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-pvlx-ex-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-dod-pvlx-gn-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-bond-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-cerf-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-dpng-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-faog-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-iaea-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-ifad-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-ilog-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-imfc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-imfn-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-mibr-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-mlat-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-nifc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-offt-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-pbnd-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-pcbk-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-pcbo-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-pngb-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-pngc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-prop-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-prvt-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-rdbc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-rdbn-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-sdgf-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-sprp-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unai-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-uncd-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-uncf-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-uncr-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-uncv-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-undp-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unep-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unfp-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unido-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unpb-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unrw-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-unwn-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-wfpg-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-whol-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-nfl-witc-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-oda-odat-gi-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-oda-odat-gn-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-oda-odat-mp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-oda-odat-pc-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-oda-odat-xp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dect-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dect-ex-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dect-gn-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dppf-xp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dppg-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dppg-gn-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-dppg-xp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-mlat-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:dt-tds-mlat-pg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:eg-egy-prim-pp-kd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:eg-elc-accs-ru-zs','approved','v16.2.2 catalog review: clear, objective country comparison worth keeping; source/integrity gates remain authoritative.'),
    ('worldbank-catalog:eg-elc-accs-ur-zs','approved','v16.2.2 catalog review: clear, objective country comparison worth keeping; source/integrity gates remain authoritative.'),
    ('worldbank-catalog:eg-elc-coal-zs','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:eg-elc-nucl-zs','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:eg-gdp-puse-ko-pp-kd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:eg-imp-cons-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:eg-use-comm-fo-zs','approved','v16.2.2 catalog review: clear, objective country comparison worth keeping; source/integrity gates remain authoritative.'),
    ('worldbank-catalog:eg-use-comm-gd-pp-kd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:en-ghg-ch4-ip-mt-ce-ar5','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:en-ghg-co2-wa-mt-ce-ar5','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:er-gdp-fwtl-m3-kd','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:er-h2o-fwst-zs','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:fb-ast-nper-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fb-bnk-capa-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fb-cbk-brwr-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fb-cbk-dptr-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fd-ast-prvt-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fi-res-totl-dt-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-ast-cgov-zg-m3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-ast-domo-zg-m3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-ast-doms-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-ast-nfrg-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-ast-prvt-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-ast-prvt-zg-m3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-lbl-bmny-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-lbl-bmny-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-lbl-bmny-ir-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fm-lbl-bmny-zg','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fr-inr-dpst','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fr-inr-lend','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fr-inr-lndp','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fr-inr-rinr','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fr-inr-risk','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fs-ast-domo-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fs-ast-doms-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fs-ast-prvt-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-40-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-60-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-fe-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-ma-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-ol-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-pl-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:fx-own-totl-so-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gb-xpd-rsdv-gd-zs','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:gc-ast-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-ast-totl-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-dod-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-dod-totl-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-lbl-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-lbl-totl-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-nfn-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-nfn-totl-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-nld-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-nld-totl-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-rev-gotr-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-rev-gotr-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-rev-socl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-rev-socl-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-rev-xgrt-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-rev-xgrt-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-expt-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-expt-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-gsrv-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-gsrv-rv-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-gsrv-va-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-impt-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-impt-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-intt-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-intt-rv-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-othr-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-othr-rv-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-totl-gd-zs','approved','v16.2.2 catalog review: clear, objective country comparison worth keeping; source/integrity gates remain authoritative.'),
    ('worldbank-catalog:gc-tax-ypkg-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-ypkg-rv-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-tax-ypkg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-comp-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-comp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-gsrv-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-gsrv-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-intp-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-intp-rv-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-intp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-othr-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-othr-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-totl-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-totl-gd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-trft-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gc-xpn-trft-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:gf-xpd-budg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-be-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-be-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-be-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-bi-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-bi-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-bi-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-bl-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-bl-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-bl-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-dr-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-dr-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-dr-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-fs-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-fs-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-fs-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-it-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-it-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-it-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-lb-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-lb-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-lb-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-mc-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-mc-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-mc-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-p1-rf','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-p2-ps','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-p3-oe','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-tx-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-tx-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-tx-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-us-p1','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-us-p2','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-bre-us-p3','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-cus-durs-ex','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-cus-durs-im','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-elc-durs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-elc-outg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-bkwc-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-bnkl-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-bnks-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-brib-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-cdp-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-cmpu-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-co2-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-corr-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-crdc-fl-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-crdc-pt-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-durs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-engm-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-exs-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-femm-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-femo-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-fo-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-freg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-lotm-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-metg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-nprd-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-outg-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-taxe-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-frm-trng-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-gov-durs-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-tax-gift-zs','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ic-tax-metg','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppi-engy-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppi-icti-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppi-tran-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppi-watr-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppn-engy-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppn-icti-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppn-tran-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ie-ppn-watr-cd','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-breg-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-debt-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-econ-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-envr-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-finq-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-fins-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-fisp-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-gndr-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-hres-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-macr-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-padm-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-pres-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-prop-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-prot-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-pubs-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-revn-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-soci-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-strc-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-trad-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:iq-cpa-tran-xq','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:is-shp-good-tu','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ms-mil-xpnd-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ms-mil-xprt-kd','needs_discussion','v16.2.2 catalog review: worthwhile concept, but source coverage/audit or comparability needs focused follow-up before gameplay.'),
    ('worldbank-catalog:ne-gdi-stkb-cn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.'),
    ('worldbank-catalog:ne-gdi-stkb-kn','rejected','v16.2.2 catalog review: removed from the unresolved backlog because the concept is too technical, duplicative, narrow, weakly comparable, or insufficiently useful for GeoStats.')
on conflict(category_id) do update set
  decision=excluded.decision,
  rationale=excluded.rationale,
  applied_at=now();

create or replace function public.category_v15_source_is_official(p_source text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_source,'')) in (
    'world bank','faostat','faostat food balances','who','ilostat','natural earth',
    'un comtrade','u.s. eia','eia','unhcr','un tourism','imf','oecd',
    'un population division','united nations population division',
    'pew research center','smithsonian gvp','usgs','unesco world heritage centre',
    'esa worldcover','hydrosheds','global elevation','fao aquastat','usgs minerals','fao fisheries',
    'united nations','constitute project'
  )
$$;

create or replace function public.category_v16_2_quality_floor(p_source text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_source,''))
    when 'natural earth' then 55
    when 'pew research center' then 55
    when 'smithsonian gvp' then 60
    when 'usgs' then 60
    when 'united nations' then 60
    when 'constitute project' then 60
    when 'world bank' then 65
    when 'faostat food balances' then 65
    when 'unhcr' then 65
    when 'who' then 65
    else 70
  end
$$;

create or replace function public.refresh_category_ranking_completeness_v16()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_ranking_completeness_v16 where category_id is not null;

  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,
    top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select q.id,q.source_organization,q.ranking_direction,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year
    from public.category_review_queue_v15 q
  ), ranked as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,o.value,
           row_number() over(
             partition by y.id
             order by
               case when y.ranking_direction='high' then o.value end desc nulls last,
               case when y.ranking_direction='low' then o.value end asc nulls last,
               o.country_iso3
           ) as ranking_position
    from selected_year y
    join public.stat_observations o
      on o.category_id=y.id and o.data_year=y.assessed_year
  ), metrics as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,
           count(r.value)::integer as observation_count,
           count(distinct r.value)::integer as distinct_value_count,
           count(distinct r.value) filter(where r.ranking_position<=50)::integer as top_value_distinct_count
    from selected_year y
    left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.ranking_direction,y.assessed_year
  )
  select id,
    case
      when assessed_year is null or observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when observation_count>=100 and top_value_distinct_count>=15 then 'top_end_complete'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project'
      ) and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive'
    end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete coverage cannot safely support a lowest-wins ranking.'
      when observation_count>=100 and top_value_distinct_count>=15
        then 'The high end is sufficiently covered and distinct for gameplay even though some countries are omitted.'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project'
      ) and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful high end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful top ranking.'
    end,
    observation_count,distinct_value_count,top_value_distinct_count,
    (top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;
revoke all on function public.refresh_category_ranking_completeness_v16() from public,anon,authenticated;
grant execute on function public.refresh_category_ranking_completeness_v16() to service_role;

create or replace function public.apply_v16_2_2_copy_corrections()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories c
  set title=x.title,
      short_title=x.title,
      description=x.description,
      plain_language_description=x.description,
      updated_at=now()
  from (values
    ('basicWater','Highest share with basic drinking-water access','Share of the population using at least basic drinking-water services.'),
    ('electricityAccess','Highest share with electricity access','Share of the population with access to electricity.'),
    ('femaleLabor','Highest female labor-force participation rate','Share of women age 15+ who are working or actively looking for work.'),
    ('forestPct','Largest forest share of land','Share of the country’s land area covered by forest.'),
    ('natural-earth:highest-mapped-glaciated-share','Largest glaciated share of land','Share of mapped land covered by Natural Earth glaciated areas.'),
    ('natural-earth:highest-mapped-lake-share','Largest lake share of land','Share of mapped land area covered by Natural Earth lakes and reservoirs.'),
    ('who:WSH_SANITATION_SAFELY_MANAGED','Highest share with safely managed sanitation','Share of the population using safely managed sanitation services.'),
    ('who:WSH_WATER_SAFELY_MANAGED','Highest share with safely managed drinking-water access','Share of the population using safely managed drinking-water services.'),
    ('worldbank-catalog:ag-lnd-crop-zs','Largest permanent-cropland share of land','Share of land area devoted to permanent crops such as cocoa, coffee, and rubber.'),
    ('worldbank-catalog:bm-gsr-insf-zs','Largest insurance-and-financial-services share of service imports','Share of commercial service imports made up of insurance and financial services.'),
    ('worldbank-catalog:bx-gsr-ccis-zs','Largest ICT-service share of service exports','Share of commercial service exports made up of information and communication technology services.'),
    ('worldbank-catalog:bx-gsr-insf-zs','Largest insurance-and-financial-services share of service exports','Share of commercial service exports made up of insurance and financial services.'),
    ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','Largest remittances received as a share of GDP','Personal remittances received as a share of gross domestic product.'),
    ('worldbank-catalog:dt-dod-dstc-zs','Highest short-term share of external debt','Short-term debt as a share of total external debt.'),
    ('worldbank-catalog:eg-cft-accs-ru-zs','Highest rural share using clean cooking fuels','Share of the rural population primarily using clean fuels and technologies for cooking.'),
    ('worldbank-catalog:eg-cft-accs-ur-zs','Highest urban share using clean cooking fuels','Share of the urban population primarily using clean fuels and technologies for cooking.'),
    ('worldbank-catalog:eg-cft-accs-zs','Highest share using clean cooking fuels','Share of the population primarily using clean fuels and technologies for cooking.'),
    ('worldbank-catalog:eg-elc-accs-ru-zs','Highest rural electricity-access share','Share of the rural population with access to electricity.'),
    ('worldbank-catalog:eg-elc-accs-ur-zs','Highest urban electricity-access share','Share of the urban population with access to electricity.'),
    ('worldbank-catalog:eg-elc-fosl-zs','Largest fossil-fuel share of electricity generation','Share of electricity generated from oil, gas, and coal sources.'),
    ('worldbank-catalog:eg-elc-hyro-zs','Largest hydroelectric share of electricity generation','Share of electricity generated from hydroelectric sources.'),
    ('worldbank-catalog:eg-elc-loss-zs','Highest electricity transmission and distribution loss rate','Electricity lost in transmission and distribution as a share of electricity output.'),
    ('worldbank-catalog:eg-elc-ngas-zs','Largest natural-gas share of electricity generation','Share of electricity generated from natural gas.'),
    ('worldbank-catalog:eg-elc-petr-zs','Largest oil share of electricity generation','Share of electricity generated from oil sources.'),
    ('worldbank-catalog:eg-use-comm-cl-zs','Largest alternative-and-nuclear share of energy use','Share of energy use supplied by alternative and nuclear energy.'),
    ('worldbank-catalog:eg-use-comm-fo-zs','Largest fossil-fuel share of energy use','Share of total energy use supplied by fossil fuels.'),
    ('worldbank-catalog:eg-use-crnw-zs','Largest combustible-renewables-and-waste share of energy use','Share of energy use supplied by combustible renewables and waste.'),
    ('worldbank-catalog:en-pop-slum-ur-zs','Largest share of urban population living in slums','Share of the urban population living in slum households.'),
    ('worldbank-catalog:en-urb-lcty-ur-zs','Largest share of urban population living in the largest city','Share of the urban population living in the country’s largest metropolitan area.'),
    ('worldbank-catalog:en-urb-mcty-tl-zs','Largest share of population in million-plus urban areas','Share of the population living in urban agglomerations with more than one million people.'),
    ('worldbank-catalog:er-h2o-fwag-zs','Largest agriculture share of freshwater withdrawals','Share of total freshwater withdrawals used by agriculture.'),
    ('worldbank-catalog:er-h2o-fwin-zs','Largest industry share of freshwater withdrawals','Share of total freshwater withdrawals used by industry.'),
    ('worldbank-catalog:er-mrn-ptmr-zs','Largest protected share of territorial waters','Share of territorial waters designated as marine protected areas.'),
    ('worldbank-catalog:er-ptd-totl-zs','Largest protected share of land and sea','Share of each country’s terrestrial and marine area designated as protected.'),
    ('worldbank-catalog:fx-own-totl-zs','Highest share of adults with a financial or mobile-money account','Share of adults with an account at a financial institution or a mobile-money service provider.'),
    ('worldbank-catalog:gc-tax-totl-gd-zs','Largest tax-revenue share of GDP','Tax revenue as a share of gross domestic product.'),
    ('worldbank-catalog:ms-mil-xpnd-zs','Largest military share of government spending','Military expenditure as a share of general government expenditure.')
  ) as x(id,title,description)
  where c.id=x.id;

  update public.category_review_state r
  set recommended_title=x.title,
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.2 copy review: title/description explicitly identify total, share, rate, or population basis.'),
      updated_at=now()
  from (values
    ('basicWater','Highest share with basic drinking-water access','Share of the population using at least basic drinking-water services.'),
    ('electricityAccess','Highest share with electricity access','Share of the population with access to electricity.'),
    ('femaleLabor','Highest female labor-force participation rate','Share of women age 15+ who are working or actively looking for work.'),
    ('forestPct','Largest forest share of land','Share of the country’s land area covered by forest.'),
    ('natural-earth:highest-mapped-glaciated-share','Largest glaciated share of land','Share of mapped land covered by Natural Earth glaciated areas.'),
    ('natural-earth:highest-mapped-lake-share','Largest lake share of land','Share of mapped land area covered by Natural Earth lakes and reservoirs.'),
    ('who:WSH_SANITATION_SAFELY_MANAGED','Highest share with safely managed sanitation','Share of the population using safely managed sanitation services.'),
    ('who:WSH_WATER_SAFELY_MANAGED','Highest share with safely managed drinking-water access','Share of the population using safely managed drinking-water services.'),
    ('worldbank-catalog:ag-lnd-crop-zs','Largest permanent-cropland share of land','Share of land area devoted to permanent crops such as cocoa, coffee, and rubber.'),
    ('worldbank-catalog:bm-gsr-insf-zs','Largest insurance-and-financial-services share of service imports','Share of commercial service imports made up of insurance and financial services.'),
    ('worldbank-catalog:bx-gsr-ccis-zs','Largest ICT-service share of service exports','Share of commercial service exports made up of information and communication technology services.'),
    ('worldbank-catalog:bx-gsr-insf-zs','Largest insurance-and-financial-services share of service exports','Share of commercial service exports made up of insurance and financial services.'),
    ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','Largest remittances received as a share of GDP','Personal remittances received as a share of gross domestic product.'),
    ('worldbank-catalog:dt-dod-dstc-zs','Highest short-term share of external debt','Short-term debt as a share of total external debt.'),
    ('worldbank-catalog:eg-cft-accs-ru-zs','Highest rural share using clean cooking fuels','Share of the rural population primarily using clean fuels and technologies for cooking.'),
    ('worldbank-catalog:eg-cft-accs-ur-zs','Highest urban share using clean cooking fuels','Share of the urban population primarily using clean fuels and technologies for cooking.'),
    ('worldbank-catalog:eg-cft-accs-zs','Highest share using clean cooking fuels','Share of the population primarily using clean fuels and technologies for cooking.'),
    ('worldbank-catalog:eg-elc-accs-ru-zs','Highest rural electricity-access share','Share of the rural population with access to electricity.'),
    ('worldbank-catalog:eg-elc-accs-ur-zs','Highest urban electricity-access share','Share of the urban population with access to electricity.'),
    ('worldbank-catalog:eg-elc-fosl-zs','Largest fossil-fuel share of electricity generation','Share of electricity generated from oil, gas, and coal sources.'),
    ('worldbank-catalog:eg-elc-hyro-zs','Largest hydroelectric share of electricity generation','Share of electricity generated from hydroelectric sources.'),
    ('worldbank-catalog:eg-elc-loss-zs','Highest electricity transmission and distribution loss rate','Electricity lost in transmission and distribution as a share of electricity output.'),
    ('worldbank-catalog:eg-elc-ngas-zs','Largest natural-gas share of electricity generation','Share of electricity generated from natural gas.'),
    ('worldbank-catalog:eg-elc-petr-zs','Largest oil share of electricity generation','Share of electricity generated from oil sources.'),
    ('worldbank-catalog:eg-use-comm-cl-zs','Largest alternative-and-nuclear share of energy use','Share of energy use supplied by alternative and nuclear energy.'),
    ('worldbank-catalog:eg-use-comm-fo-zs','Largest fossil-fuel share of energy use','Share of total energy use supplied by fossil fuels.'),
    ('worldbank-catalog:eg-use-crnw-zs','Largest combustible-renewables-and-waste share of energy use','Share of energy use supplied by combustible renewables and waste.'),
    ('worldbank-catalog:en-pop-slum-ur-zs','Largest share of urban population living in slums','Share of the urban population living in slum households.'),
    ('worldbank-catalog:en-urb-lcty-ur-zs','Largest share of urban population living in the largest city','Share of the urban population living in the country’s largest metropolitan area.'),
    ('worldbank-catalog:en-urb-mcty-tl-zs','Largest share of population in million-plus urban areas','Share of the population living in urban agglomerations with more than one million people.'),
    ('worldbank-catalog:er-h2o-fwag-zs','Largest agriculture share of freshwater withdrawals','Share of total freshwater withdrawals used by agriculture.'),
    ('worldbank-catalog:er-h2o-fwin-zs','Largest industry share of freshwater withdrawals','Share of total freshwater withdrawals used by industry.'),
    ('worldbank-catalog:er-mrn-ptmr-zs','Largest protected share of territorial waters','Share of territorial waters designated as marine protected areas.'),
    ('worldbank-catalog:er-ptd-totl-zs','Largest protected share of land and sea','Share of each country’s terrestrial and marine area designated as protected.'),
    ('worldbank-catalog:fx-own-totl-zs','Highest share of adults with a financial or mobile-money account','Share of adults with an account at a financial institution or a mobile-money service provider.'),
    ('worldbank-catalog:gc-tax-totl-gd-zs','Largest tax-revenue share of GDP','Tax revenue as a share of gross domestic product.'),
    ('worldbank-catalog:ms-mil-xpnd-zs','Largest military share of government spending','Military expenditure as a share of general government expenditure.')
  ) as x(id,title,description)
  where r.category_id=x.id;

  update public.category_review_state
  set status='rejected',
      notes=concat_ws(E'\n',nullif(notes,''),'v16.2.2: Largest sports-equipment exports removed as too niche/contrived for the core catalog.'),
      updated_at=now(),reviewed_at=coalesce(reviewed_at,now())
  where category_id='comtrade:most-sports-equipment-exported';

  update public.stat_categories
  set enabled=false,eligible_daily=false,review_status='rejected',
      curation_status='excluded',curation_reason='v16.2.2 product decision: too niche/contrived.',
      content_review_status='excluded',content_review_reason='v16.2.2 product decision: too niche/contrived.',
      updated_at=now()
  where id='comtrade:most-sports-equipment-exported';
end;
$$;
revoke all on function public.apply_v16_2_2_copy_corrections() from public,anon,authenticated;
grant execute on function public.apply_v16_2_2_copy_corrections() to service_role;

create or replace function public.apply_v16_2_2_backlog_dispositions()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.category_review_state r
  set status=d.decision,
      political_self_reported=false,
      confusing=false,
      subjective_or_composite=false,
      stale_data=false,
      poor_coverage=false,
      notes=concat_ws(E'\n',nullif(r.notes,''),d.rationale),
      reviewed_at=coalesce(r.reviewed_at,now()),
      updated_at=now()
  from public.category_release_decisions_v16_2_2 d
  where d.category_id=r.category_id
    and r.status in ('pending','needs_rewrite','needs_discussion');

  update public.stat_categories c
  set review_status=case d.decision
        when 'approved' then 'approved'
        when 'rejected' then 'rejected'
        else 'needs_review'
      end,
      curation_status=case d.decision
        when 'approved' then 'approved'
        when 'rejected' then 'excluded'
        else case when c.curation_status='excluded' then 'pending' else coalesce(c.curation_status,'pending') end
      end,
      curation_reason=case d.decision
        when 'approved' then 'v16.2.2 full backlog review approved this category concept.'
        when 'rejected' then d.rationale
        else 'v16.2.2 retained this worthwhile concept for focused source/data follow-up.'
      end,
      content_review_status=case d.decision
        when 'approved' then 'approved'
        when 'rejected' then 'excluded'
        else case when c.content_review_status='excluded' then 'pending' else c.content_review_status end
      end,
      content_review_reason=case d.decision
        when 'approved' then 'v16.2.2 full backlog review: clear and worthwhile for GeoStats.'
        when 'rejected' then d.rationale
        else 'v16.2.2: concept retained, but not playable until focused follow-up is complete.'
      end,
      enabled=false,
      eligible_daily=false,
      updated_at=now()
  from public.category_release_decisions_v16_2_2 d
  where d.category_id=c.id;

  update public.stat_categories
  set credibility_status='approved',
      credibility_score=greatest(coalesce(credibility_score,0),75),
      credibility_reason='v16.2.2: current source audit verified Natural Earth geometry-derived values and rankings.',
      updated_at=now()
  where id in ('natural-earth:largest-mapped-glaciated-area', 'natural-earth:largest-mapped-lake-area', 'natural-earth:largest-single-mapped-lake', 'natural-earth:longest-coastline', 'natural-earth:most-mapped-lakes', 'natural-earth:most-mapped-rivers')
    and validation_status='verified'
    and coalesce(validation_mismatch_count,0)=0
    and coalesce(validation_ranking_mismatch_count,0)=0;
end;
$$;
revoke all on function public.apply_v16_2_2_backlog_dispositions() from public,anon,authenticated;
grant execute on function public.apply_v16_2_2_backlog_dispositions() to service_role;

create or replace function public.refresh_measurement_types_v16_2_2()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories
  set measurement_type=case
      when lower(coalesce(metadata->>'measurementType',metadata->>'measurement_type',''))='historical_date'
        or source_organization in ('United Nations','Constitute Project') then 'historical_date'
      when lower(coalesce(value_type,''))='percentage'
        or lower(coalesce(unit,'')) ~ '(^%$|percent|percentage|% of|share)'
        or lower(coalesce(title,'')) ~ '(share|percentage|percent)' then 'share'
      when lower(coalesce(value_type,''))='per_capita'
        or lower(coalesce(unit,'')) ~ '(per person|per capita|per 100|per 1,?000|per 10,?000|per 100,?000|per million)'
        or lower(coalesce(title,'')) ~ '(per person|per capita|per 100|per 1,?000|per 10,?000|per 100,?000|per million)' then 'per_capita'
      when lower(coalesce(value_type,''))='total' then 'total'
      else 'other'
    end,
    updated_at=now()
  where measurement_type is distinct from case
      when lower(coalesce(metadata->>'measurementType',metadata->>'measurement_type',''))='historical_date'
        or source_organization in ('United Nations','Constitute Project') then 'historical_date'
      when lower(coalesce(value_type,''))='percentage'
        or lower(coalesce(unit,'')) ~ '(^%$|percent|percentage|% of|share)'
        or lower(coalesce(title,'')) ~ '(share|percentage|percent)' then 'share'
      when lower(coalesce(value_type,''))='per_capita'
        or lower(coalesce(unit,'')) ~ '(per person|per capita|per 100|per 1,?000|per 10,?000|per 100,?000|per million)'
        or lower(coalesce(title,'')) ~ '(per person|per capita|per 100|per 1,?000|per 10,?000|per 100,?000|per million)' then 'per_capita'
      when lower(coalesce(value_type,''))='total' then 'total'
      else 'other'
    end;
end;
$$;
revoke all on function public.refresh_measurement_types_v16_2_2() from public,anon,authenticated;
grant execute on function public.refresh_measurement_types_v16_2_2() to service_role;

create or replace function public.apply_v16_2_2_catalog_curation()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.apply_v16_2_2_copy_corrections();

  update public.category_review_state r
  set status='approved',
      political_self_reported=false,confusing=false,esoteric=false,
      subjective_or_composite=false,stale_data=false,poor_coverage=false,
      duplicate_of=null,
      recommended_title=c.title,
      semantic_group=coalesce(r.semantic_group,'historical-state-institutions'),
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.2 historical release: independently source-audited and approved.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id
    and c.id in ('history:un-admission','history:newest-current-constitution')
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;

  update public.stat_categories
  set review_status='approved',
      curation_status='approved',
      curation_reason='v16.2.2 historical release: official/source-audited chronology.',
      content_review_status='approved',
      content_review_reason='v16.2.2 historical category review: clear definition, chronology, and provenance.',
      measurement_type='historical_date',
      updated_at=now()
  where id in ('history:un-admission','history:newest-current-constitution')
    and validation_status='verified';
end;
$$;
revoke all on function public.apply_v16_2_2_catalog_curation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_2_catalog_curation() to service_role;

create or replace view public.category_runtime_review_v16_2
with(security_invoker=true) as
select
  v.*,
  a.proposed_status as promotion_decision_v16_2,
  a.reason as promotion_reason_v16_2,
  a.primary_blocker as primary_blocker_v16_2,
  a.blocker_class as blocker_class_v16_2,
  a.strict_pass as strict_pass_v16_2,
  a.source_quality_floor as source_quality_floor_v16_2,
  a.suggested_duplicate_of as suggested_duplicate_of_v16_2,
  (
    a.proposed_status='playable'
    and v.editorial_status='approved'
    and a.strict_pass
  ) as computed_playable_v16_2,
  array_remove(array[
    case when a.proposed_status<>'playable' then a.primary_blocker end
  ],null) as v16_2_blockers,
  array_remove(array[
    case when v.validation_status<>'verified'
      and not public.category_v15_true_integrity_failure(
        v.validation_status,v.validation_reason,
        v.validation_mismatch_count,v.validation_ranking_mismatch_count
      ) then 'Official values are usable; non-data source metadata remain incomplete.' end,
    case when v.ranking_completeness_status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
    case when v.player_source_status='general' then 'Uses a general official source page rather than an exact shareable view.' end
  ],null) as v16_2_warnings,
  c.measurement_type
from public.category_runtime_review_v16 v
join public.category_promotion_assessment_v16_2 a on a.category_id=v.id
join public.stat_categories c on c.id=v.id;
revoke all on public.category_runtime_review_v16_2 from public,anon,authenticated;
grant select on public.category_runtime_review_v16_2 to service_role;

-- category_runtime_review_v16_2 gains measurement_type in this release. Because this
-- Workbench previously expanded runtime.* before the auto-vetting columns, CREATE OR
-- REPLACE VIEW would interpret the appended runtime column as a positional rename of
-- auto_vetting_recommendation. Recreate the Workbench so its column layout can expand.
drop view if exists public.category_review_workbench_v16_2;
create view public.category_review_workbench_v16_2
with(security_invoker=true) as
select runtime.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at
from public.category_runtime_review_v16_2 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

create or replace function public.assert_v16_2_2_source_recovery()
returns table(
  world_bank_audited integer,
  faostat_qcl_audited integer,
  who_audited integer,
  comtrade_audited integer,
  historical_verified integer,
  proposed_playable integer,
  pending_editorial integer
)
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  wb_count integer; fao_count integer; who_count integer; trade_count integer;
  history_count integer; playable_count integer; pending_count integer;
begin
  select count(*)::integer into wb_count
  from public.category_runtime_review_v16
  where source_organization='World Bank'
    and (validation_status='verified'
      or (validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%'));

  select count(*)::integer into fao_count
  from public.category_runtime_review_v16
  where source_organization='FAOSTAT'
    and source_dataset='Production: Crops and livestock products (QCL)'
    and validation_status='verified';

  select count(*)::integer into who_count
  from public.category_runtime_review_v16
  where source_organization='WHO'
    and (validation_status='verified'
      or (validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%'));

  select count(*)::integer into trade_count
  from public.category_runtime_review_v16
  where source_organization='UN Comtrade' and validation_status='verified';

  select count(*)::integer into history_count
  from public.category_runtime_review_v16
  where id in ('history:un-admission','history:newest-current-constitution')
    and validation_status='verified';

  select count(*)::integer into playable_count
  from public.category_promotion_assessment_v16_2
  where proposed_status in ('playable','auto_promote') and strict_pass;

  select count(*)::integer into pending_count
  from public.category_review_state
  where status='pending';

  if wb_count < 300 then raise exception 'v16.2.2 publication blocked: only % World Bank categories have usable source audits; expected at least 300.',wb_count; end if;
  if fao_count < 25 then raise exception 'v16.2.2 publication blocked: only % FAOSTAT QCL categories verified; expected at least 25.',fao_count; end if;
  if who_count < 15 then raise exception 'v16.2.2 publication blocked: only % WHO categories have usable audits; expected at least 15.',who_count; end if;
  if trade_count < 40 then raise exception 'v16.2.2 publication blocked: only % UN Comtrade categories verified; expected at least 40.',trade_count; end if;
  if history_count < 2 then raise exception 'v16.2.2 publication blocked: only % of 2 historical launch categories verified.',history_count; end if;
  if playable_count < 260 then raise exception 'v16.2.2 publication blocked: only % categories pass the shared Daily/Random gate; expected at least 260 after cleanup.',playable_count; end if;
  if pending_count <> 0 then raise exception 'v16.2.2 publication blocked: % category review rows are still pending.',pending_count; end if;

  return query select wb_count,fao_count,who_count,trade_count,history_count,playable_count,pending_count;
end;
$$;
revoke all on function public.assert_v16_2_2_source_recovery() from public,anon,authenticated;
grant execute on function public.assert_v16_2_2_source_recovery() to service_role;

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_2_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_2_source_recovery();

  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.2-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_2_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_2_source_recovery();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

do $$
declare
  v_pgcrypto_schema text;
begin
  if to_regprocedure('public.publish_daily_trio_v16(date,jsonb)') is null then
    raise exception 'publish_daily_trio_v16(date,jsonb) is not installed.';
  end if;
  select n.nspname into v_pgcrypto_schema
  from pg_extension e join pg_namespace n on n.oid=e.extnamespace
  where e.extname='pgcrypto';
  if v_pgcrypto_schema is null then raise exception 'pgcrypto extension is not installed.'; end if;
  execute format(
    'alter function public.publish_daily_trio_v16(date,jsonb) set search_path = public, %I',
    v_pgcrypto_schema
  );
end $$;
revoke all on function public.publish_daily_trio_v16(date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_daily_trio_v16(date,jsonb) to service_role;

select public.apply_v16_2_2_backlog_dispositions();
select public.apply_v16_2_2_copy_corrections();
select public.refresh_measurement_types_v16_2_2();
select public.apply_v16_2_1_audit_reconciliation();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

notify pgrst,'reload schema';
commit;

-- GeoStats v16.2.3: reliability, performance-ready catalog state, and broad historical expansion.
-- Upgrade migration: run after v16.2.2. Safe to rerun.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.2.3-release-upgrade'));

do $$
begin
  if to_regprocedure('public.assert_v16_2_2_source_recovery()') is null
     or to_regclass('public.category_release_decisions_v16_2_2') is null then
    raise exception 'GeoStats v16.2.2 must be installed before v16.2.3.';
  end if;
end $$;

insert into public.data_sources(id,name,description,status,display_order,metadata)
values
  ('ipu','Inter-Parliamentary Union','Official IPU Parline country-history fields used for post-1940 independence dates and national universal women''s suffrage milestones.','active',88,
    '{"v16_2_3":"broad_historical","manual_uploads":false}'::jsonb)
on conflict(id) do update set
  name=excluded.name,
  description=excluded.description,
  status='active',
  metadata=coalesce(public.data_sources.metadata,'{}'::jsonb)||excluded.metadata,
  updated_at=now();

create table if not exists public.category_release_decisions_v16_2_3 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  disposition text not null check(disposition in ('approved','needs_rewrite','data_repair_required','manual_review_required','duplicate','rejected')),
  rationale text not null,
  prior_v16_2_2_decision text,
  prior_blocker_class text,
  prior_primary_blocker text,
  prior_editorial_status text,
  prior_validation_status text,
  prior_ranking_completeness_status text,
  applied_at timestamptz not null default now()
);
alter table public.category_release_decisions_v16_2_3 enable row level security;
revoke all on public.category_release_decisions_v16_2_3 from public,anon,authenticated;
grant select on public.category_release_decisions_v16_2_3 to service_role;

insert into public.category_release_decisions_v16_2_3(
  category_id,disposition,rationale,prior_v16_2_2_decision,prior_blocker_class,prior_primary_blocker,
  prior_editorial_status,prior_validation_status,prior_ranking_completeness_status
)
values
    ('comtrade:most-coal-exported','manual_review_required','v16.2.3 review: broad, guessable commodity-trade concept retained for focused Comtrade quality and comparability review before gameplay.','rejected','source_specific_quality','Below the source-specific quality floor.','pending','verified','top_end_complete'),
    ('eia:most-crude-oil-produced','manual_review_required','v16.2.3 review: concept is retained for focused source, coverage, or comparability review before gameplay.','needs_discussion','source_audit_pending','Official-source value and ranking audit has not completed.','needs_discussion','failed','comprehensive'),
    ('eia:most-natural-gas-produced','manual_review_required','v16.2.3 review: concept is retained for focused source, coverage, or comparability review before gameplay.','needs_discussion','source_audit_pending','Official-source value and ranking audit has not completed.','needs_discussion','failed','comprehensive'),
    ('natural-earth:highest-coastline-density','manual_review_required','v16.2.3 review: broad physical-geography concept retained for focused review of the coastline-for-area definition and Natural Earth scale sensitivity before gameplay.','rejected','editorial_content_review','GeoStats v15 authoritative category review state: pending.','pending','verified','comprehensive'),
    ('who:PHE_HHAIR_PROP_POP_CLEAN_FUELS','manual_review_required','v16.2.3 review: concept is retained for focused source, coverage, or comparability review before gameplay.','needs_discussion','ranking_completeness','Fewer than 30 countries have comparable observations.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ag-con-fert-pt-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ag-lnd-irig-ag-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','needs_discussion','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:bm-klt-dinv-wd-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:bn-cab-xoka-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:bn-cab-xoka-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:bx-trf-pwkr-dt-gd-zs','approved','v16.2.3 review: concept remains approved; normal source, semantic, ranking, and gameplay gates still control playability.','approved','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:cm-mkt-indx-zg','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:cm-mkt-lcap-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:cm-mkt-lcap-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:cm-mkt-ldom-no','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:cm-mkt-trad-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:cm-mkt-trnr','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-ausl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-autl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-bell-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-canl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-cecl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-chel-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-czel-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-deul-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-dnkl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-espl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-estl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-finl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-fral-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-gbrl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-grcl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dc-dac-hunl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-irll-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-isll-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-ital-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-jpnl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-korl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-ltul-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-luxl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-nldl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-norl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-nzll-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-poll-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-prtl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-svkl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-svnl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-dac-swel-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-totl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-dac-usal-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dc-oda-tldc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-oda-tldc-gn-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-oda-totl-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dc-oda-totl-kd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dect-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dect-gn-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dimf-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dlxf-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dpng-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dppg-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dstc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dstc-ir-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-dstc-xp-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-mibr-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-dod-mida-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-pvlx-ex-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-dod-pvlx-gn-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-bond-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-cerf-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-dpng-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-faog-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-iaea-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-ifad-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-ilog-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-imfc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-imfn-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-mibr-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-mlat-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-nifc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-offt-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-pbnd-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-pcbk-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-pcbo-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-pngb-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-pngc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-prop-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-prvt-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-rdbc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-rdbn-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-sdgf-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-sprp-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unai-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-uncd-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-uncf-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-uncr-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-uncv-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-undp-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unep-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unfp-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unido-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unpb-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unrw-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-unwn-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-wfpg-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-whol-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-nfl-witc-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-oda-odat-gi-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-oda-odat-gn-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-oda-odat-mp-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-oda-odat-pc-zs','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-oda-odat-xp-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dect-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dect-ex-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dect-gn-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dppf-xp-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dppg-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dppg-gn-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-dppg-xp-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-mlat-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:dt-tds-mlat-pg-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:eg-egy-prim-pp-kd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:eg-elc-accs-ru-zs','approved','v16.2.3 review: concept remains approved; normal source, semantic, ranking, and gameplay gates still control playability.','approved','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','comprehensive'),
    ('worldbank-catalog:eg-elc-accs-ur-zs','approved','v16.2.3 review: concept remains approved; normal source, semantic, ranking, and gameplay gates still control playability.','approved','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','comprehensive'),
    ('worldbank-catalog:eg-elc-coal-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','needs_discussion','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:eg-elc-nucl-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','needs_discussion','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:eg-gdp-puse-ko-pp-kd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:eg-imp-cons-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:eg-use-comm-fo-zs','approved','v16.2.3 review: concept remains approved; normal source, semantic, ranking, and gameplay gates still control playability.','approved','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:eg-use-comm-gd-pp-kd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:en-ghg-ch4-ip-mt-ce-ar5','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:en-ghg-co2-wa-mt-ce-ar5','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:er-gdp-fwtl-m3-kd','manual_review_required','v16.2.3 review: concept is retained for focused source, coverage, or comparability review before gameplay.','needs_discussion','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:er-h2o-fwst-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','needs_discussion','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fb-ast-nper-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fb-bnk-capa-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fb-cbk-brwr-p3','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fb-cbk-dptr-p3','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fd-ast-prvt-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fi-res-totl-dt-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-ast-cgov-zg-m3','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-ast-domo-zg-m3','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-ast-doms-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-ast-nfrg-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-ast-prvt-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-ast-prvt-zg-m3','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-lbl-bmny-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-lbl-bmny-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-lbl-bmny-ir-zs','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fm-lbl-bmny-zg','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fr-inr-dpst','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fr-inr-lend','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fr-inr-lndp','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fr-inr-rinr','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fr-inr-risk','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fs-ast-domo-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fs-ast-doms-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fs-ast-prvt-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-40-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-60-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-fe-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-ma-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-ol-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-pl-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:fx-own-totl-so-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','needs_rewrite','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gb-xpd-rsdv-gd-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','needs_discussion','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-ast-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-ast-totl-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-dod-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-dod-totl-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-lbl-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-lbl-totl-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-nfn-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-nfn-totl-gd-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-nld-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-nld-totl-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-rev-gotr-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-rev-gotr-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-rev-socl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-rev-socl-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-rev-xgrt-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-rev-xgrt-gd-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-expt-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-tax-expt-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-tax-gsrv-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-gsrv-rv-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-gsrv-va-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-impt-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-tax-impt-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-tax-intt-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-tax-intt-rv-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:gc-tax-othr-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-othr-rv-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-totl-gd-zs','approved','v16.2.3 review: concept remains approved; normal source, semantic, ranking, and gameplay gates still control playability.','approved','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-ypkg-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-ypkg-rv-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-tax-ypkg-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-comp-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-comp-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-gsrv-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-gsrv-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-intp-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-intp-rv-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-intp-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-othr-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-othr-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-totl-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-totl-gd-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-trft-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gc-xpn-trft-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:gf-xpd-budg-zs','data_repair_required','v16.2.3 review: concept is not rejected, but a substantive data or semantic repair is required before source re-audit and gameplay.','rejected','substantive_data_failure','Semantic audit identified a substantive data repair.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-be-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-be-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-be-p3','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-bi-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-bi-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-bi-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-bl-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-bl-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-bl-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-dr-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-dr-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-dr-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-fs-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-fs-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-fs-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-it-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-it-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-it-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-lb-p1','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-lb-p2','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-lb-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-mc-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-mc-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-mc-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-p1-rf','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-p2-ps','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-p3-oe','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-tx-p1','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-tx-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-tx-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-us-p1','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-us-p2','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-bre-us-p3','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-cus-durs-ex','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-cus-durs-im','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-elc-durs','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-elc-outg-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-bkwc-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-bnkl-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-bnks-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-brib-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-cdp-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-cmpu-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-co2-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-corr-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-crdc-fl-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-crdc-pt-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-durs','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-engm-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-exs-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-femm-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-femo-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-fo-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-freg-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-lotm-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-metg-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-nprd-zs','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-outg-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-taxe-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-frm-trng-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-gov-durs-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-tax-gift-zs','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ic-tax-metg','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ie-ppi-engy-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ie-ppi-icti-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ie-ppi-tran-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:ie-ppi-watr-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:ie-ppn-engy-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ie-ppn-icti-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ie-ppn-tran-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:ie-ppn-watr-cd','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','source_audit_pending','Official-source value and ranking audit has not completed.','pending','failed','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-breg-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-debt-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-econ-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-envr-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-finq-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-fins-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-fisp-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-gndr-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-hres-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-macr-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-padm-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-pres-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-prop-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-prot-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-pubs-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-revn-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-soci-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-strc-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-trad-xq','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:iq-cpa-tran-xq','needs_rewrite','v16.2.3 review: concept may be useful, but player-facing title, description, unit, or interpretation needs a clear rewrite before gameplay.','rejected','copy_or_semantic_rewrite','Player-facing title, description, or unit needs a clearer rewrite.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:is-shp-good-tu','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:ms-mil-xpnd-cn','duplicate','v16.2.3 review: duplicate player concept of the existing comparable military-spending category; the current-local-currency series is not a valid cross-country alternative.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:ms-mil-xprt-kd','manual_review_required','v16.2.3 review: concept is retained for focused source, coverage, or comparability review before gameplay.','needs_discussion','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive'),
    ('worldbank-catalog:ne-gdi-stkb-cn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','verified','non_comprehensive'),
    ('worldbank-catalog:ne-gdi-stkb-kn','rejected','v16.2.3 review: concept is intentionally excluded because it is too technical, narrow, duplicative, weakly comparable, or insufficiently useful for GeoStats.','rejected','ranking_completeness','One or more omitted countries could plausibly alter the meaningful top ranking.','pending','unable_to_verify','non_comprehensive')
on conflict(category_id) do update set
  disposition=excluded.disposition,
  rationale=excluded.rationale,
  prior_v16_2_2_decision=excluded.prior_v16_2_2_decision,
  prior_blocker_class=excluded.prior_blocker_class,
  prior_primary_blocker=excluded.prior_primary_blocker,
  prior_editorial_status=excluded.prior_editorial_status,
  prior_validation_status=excluded.prior_validation_status,
  prior_ranking_completeness_status=excluded.prior_ranking_completeness_status,
  applied_at=now();

create or replace function public.apply_v16_2_3_backlog_dispositions()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.category_review_state r
  set status=case d.disposition
        when 'approved' then 'approved'
        when 'needs_rewrite' then 'needs_rewrite'
        when 'data_repair_required' then 'needs_discussion'
        when 'manual_review_required' then 'needs_discussion'
        when 'duplicate' then 'duplicate'
        else 'rejected'
      end,
      notes=concat_ws(E'\n',nullif(r.notes,''),d.rationale),
      reviewed_at=coalesce(r.reviewed_at,now()),
      updated_at=now()
  from public.category_release_decisions_v16_2_3 d
  where d.category_id=r.category_id;

  update public.stat_categories c
  set review_status=case d.disposition
        when 'approved' then 'approved'
        when 'rejected' then 'rejected'
        when 'duplicate' then 'rejected'
        else 'needs_review'
      end,
      curation_status=case d.disposition
        when 'approved' then 'approved'
        when 'rejected' then 'excluded'
        when 'duplicate' then 'excluded'
        else 'pending'
      end,
      curation_reason=d.rationale,
      content_review_status=case d.disposition
        when 'approved' then 'approved'
        when 'rejected' then 'excluded'
        when 'duplicate' then 'excluded'
        else 'pending'
      end,
      content_review_reason=d.rationale,
      enabled=false,
      eligible_daily=false,
      updated_at=now()
  from public.category_release_decisions_v16_2_3 d
  where d.category_id=c.id;
end;
$$;
revoke all on function public.apply_v16_2_3_backlog_dispositions() from public,anon,authenticated;
grant execute on function public.apply_v16_2_3_backlog_dispositions() to service_role;

create or replace function public.refresh_category_ranking_completeness_v16()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_ranking_completeness_v16 where category_id is not null;

  insert into public.category_ranking_completeness_v16(
    category_id,status,reason,observation_count,distinct_value_count,
    top_value_distinct_count,top_value_feasible,assessed_year,assessed_at
  )
  with selected_year as (
    select q.id,q.source_organization,q.ranking_direction,
           coalesce(q.common_year,q.latest_available_year)::smallint as assessed_year
    from public.category_review_queue_v15 q
  ), ranked as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,o.value,
           row_number() over(
             partition by y.id
             order by
               case when y.ranking_direction='high' then o.value end desc nulls last,
               case when y.ranking_direction='low' then o.value end asc nulls last,
               o.country_iso3
           ) as ranking_position
    from selected_year y
    join public.stat_observations o
      on o.category_id=y.id and o.data_year=y.assessed_year
  ), metrics as (
    select y.id,y.source_organization,y.ranking_direction,y.assessed_year,
           count(r.value)::integer as observation_count,
           count(distinct r.value)::integer as distinct_value_count,
           count(distinct r.value) filter(where r.ranking_position<=50)::integer as top_value_distinct_count
    from selected_year y
    left join ranked r on r.id=y.id
    group by y.id,y.source_organization,y.ranking_direction,y.assessed_year
  )
  select id,
    case
      when assessed_year is null or observation_count<30 then 'non_comprehensive'
      when observation_count>=185 then 'comprehensive'
      when ranking_direction='low' then 'non_comprehensive'
      when observation_count>=100 and top_value_distinct_count>=15 then 'top_end_complete'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union'
      ) and top_value_distinct_count>=10 then 'top_end_complete'
      else 'non_comprehensive'
    end,
    case
      when assessed_year is null then 'No common comparison year is available.'
      when observation_count<30 then 'Fewer than 30 countries have comparable observations.'
      when observation_count>=185 then 'The common-year ranking covers nearly the full supported country universe.'
      when ranking_direction='low' then 'Incomplete coverage cannot safely support a lowest-wins ranking.'
      when observation_count>=100 and top_value_distinct_count>=15
        then 'The high end is sufficiently covered and distinct for gameplay even though some countries are omitted.'
      when source_organization in (
        'FAOSTAT','FAOSTAT Food Balances','Natural Earth','Pew Research Center',
        'Smithsonian GVP','USGS','UN Comtrade','UNHCR','United Nations','Constitute Project','Inter-Parliamentary Union'
      ) and top_value_distinct_count>=10
        then 'The source is structurally sparse, but the meaningful high end contains enough distinct ranked values.'
      else 'One or more omitted countries could plausibly alter the meaningful top ranking.'
    end,
    observation_count,distinct_value_count,top_value_distinct_count,
    (top_value_distinct_count>=10),assessed_year,now()
  from metrics;
end;
$$;
revoke all on function public.refresh_category_ranking_completeness_v16() from public,anon,authenticated;
grant execute on function public.refresh_category_ranking_completeness_v16() to service_role;



create or replace function public.apply_v16_2_3_catalog_curation()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  perform public.apply_v16_2_2_catalog_curation();
  perform public.apply_v16_2_3_backlog_dispositions();

  -- Prefer one constitution direction. Keep the previous inverse category for provenance,
  -- but exclude it from gameplay so the catalog does not contain mirrored questions.
  update public.category_review_state
  set status='rejected',
      notes=concat_ws(E'\n',nullif(notes,''),'v16.2.3: superseded by Oldest current constitution to avoid an inverse duplicate.'),
      updated_at=now()
  where category_id='history:newest-current-constitution';

  update public.stat_categories
  set review_status='rejected',curation_status='excluded',
      curation_reason='v16.2.3: superseded by Oldest current constitution to avoid an inverse duplicate.',
      content_review_status='excluded',
      content_review_reason='v16.2.3: superseded by Oldest current constitution to avoid an inverse duplicate.',
      enabled=false,eligible_daily=false,updated_at=now()
  where id='history:newest-current-constitution';

  update public.category_review_state r
  set status='approved',political_self_reported=false,confusing=false,esoteric=false,
      subjective_or_composite=false,stale_data=false,poor_coverage=false,duplicate_of=null,
      recommended_title=c.title,
      semantic_group=coalesce(r.semantic_group,'historical-state-institutions'),
      notes=concat_ws(E'\n',nullif(r.notes,''),'v16.2.3 broad historical release: independently source-audited and approved.'),
      reviewed_at=coalesce(r.reviewed_at,now()),updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id
    and c.id in (
      'history:un-admission','history:oldest-current-constitution',
      'history:ipu-recent-independence','history:ipu-universal-womens-suffrage'
    )
    and c.validation_status='verified'
    and coalesce(c.validation_mismatch_count,0)=0
    and coalesce(c.validation_ranking_mismatch_count,0)=0;

  update public.stat_categories
  set review_status='approved',curation_status='approved',
      curation_reason='v16.2.3 historical release: broad, guessable chronology from an official/source-audited dataset.',
      content_review_status='approved',
      content_review_reason='v16.2.3 historical review: clear definition, chronology, and provenance.',
      measurement_type='historical_date',updated_at=now()
  where id in (
      'history:un-admission','history:oldest-current-constitution',
      'history:ipu-recent-independence','history:ipu-universal-womens-suffrage'
    )
    and validation_status='verified'
    and coalesce(validation_mismatch_count,0)=0
    and coalesce(validation_ranking_mismatch_count,0)=0;
end;
$$;
revoke all on function public.apply_v16_2_3_catalog_curation() from public,anon,authenticated;
grant execute on function public.apply_v16_2_3_catalog_curation() to service_role;

-- Add the explicit release disposition to the existing Workbench without changing
-- the generator's single computed-playable gate.
create or replace view public.category_review_workbench_v16_2
with(security_invoker=true) as
select runtime.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at,
 decision.disposition as release_disposition_v16_2_3,
 decision.rationale as release_disposition_reason_v16_2_3
from public.category_runtime_review_v16_2 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id
left join public.category_release_decisions_v16_2_3 decision on decision.category_id=runtime.id;
revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

create or replace function public.assert_v16_2_3_source_recovery()
returns table(
  world_bank_audited integer,
  faostat_qcl_audited integer,
  who_audited integer,
  comtrade_audited integer,
  historical_verified integer,
  proposed_playable integer,
  pending_editorial integer
)
language plpgsql
security definer
set search_path=public
set statement_timeout='120s'
as $$
declare
  wb_count integer; fao_count integer; who_count integer; trade_count integer;
  history_count integer; playable_count integer; pending_count integer;
begin
  select count(*)::integer into wb_count from public.category_runtime_review_v16
  where source_organization='World Bank'
    and (validation_status='verified' or (validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%'));
  select count(*)::integer into fao_count from public.category_runtime_review_v16
  where source_organization='FAOSTAT' and source_dataset='Production: Crops and livestock products (QCL)' and validation_status='verified';
  select count(*)::integer into who_count from public.category_runtime_review_v16
  where source_organization='WHO'
    and (validation_status='verified' or (validation_status='unable_to_verify' and coalesce(validation_reason,'') ilike 'Non-blocking audit warning:%'));
  select count(*)::integer into trade_count from public.category_runtime_review_v16
  where source_organization='UN Comtrade' and validation_status='verified';
  select count(*)::integer into history_count from public.category_runtime_review_v16
  where id in (
    'history:un-admission','history:oldest-current-constitution',
    'history:ipu-recent-independence','history:ipu-universal-womens-suffrage'
  ) and validation_status='verified';
  select count(*)::integer into playable_count from public.category_promotion_assessment_v16_2
  where proposed_status in ('playable','auto_promote') and strict_pass;
  select count(*)::integer into pending_count from public.category_review_state where status='pending';

  if wb_count < 300 then raise exception 'v16.2.3 publication blocked: only % World Bank categories have usable source audits; expected at least 300.',wb_count; end if;
  if fao_count < 25 then raise exception 'v16.2.3 publication blocked: only % FAOSTAT QCL categories verified; expected at least 25.',fao_count; end if;
  if who_count < 15 then raise exception 'v16.2.3 publication blocked: only % WHO categories have usable audits; expected at least 15.',who_count; end if;
  if trade_count < 40 then raise exception 'v16.2.3 publication blocked: only % UN Comtrade categories verified; expected at least 40.',trade_count; end if;
  if history_count < 4 then raise exception 'v16.2.3 publication blocked: only % of 4 broad historical release categories are source-verified.',history_count; end if;
  if playable_count < 260 then raise exception 'v16.2.3 publication blocked: only % categories pass the shared Daily/Random gate; expected at least 260.',playable_count; end if;
  if pending_count <> 0 then raise exception 'v16.2.3 publication blocked: % category review rows are still pending.',pending_count; end if;
  return query select wb_count,fao_count,who_count,trade_count,history_count,playable_count,pending_count;
end;
$$;
revoke all on function public.assert_v16_2_3_source_recovery() from public,anon,authenticated;
grant execute on function public.assert_v16_2_3_source_recovery() to service_role;

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_3_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_3_source_recovery();
  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
  -- Never re-enable the inverse constitution category after the shared-gate refresh.
  update public.stat_categories set enabled=false,eligible_daily=false,updated_at=now()
  where id='history:newest-current-constitution';
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2.3-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_v16_2_copy_corrections();
  perform public.apply_v16_2_1_audit_reconciliation();
  perform public.apply_v16_2_3_catalog_curation();
  perform public.refresh_measurement_types_v16_2_2();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();
  perform public.assert_v16_2_3_source_recovery();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

-- Re-assert the Daily publication dependency on every clean upgrade. This catches
-- the pgcrypto/digest schema visibility failure before the scheduled generator runs.
do $$
declare
  v_pgcrypto_schema text;
begin
  if to_regprocedure('public.publish_daily_trio_v16(date,jsonb)') is null then
    raise exception 'publish_daily_trio_v16(date,jsonb) is not installed.';
  end if;
  select n.nspname into v_pgcrypto_schema
  from pg_extension e join pg_namespace n on n.oid=e.extnamespace
  where e.extname='pgcrypto';
  if v_pgcrypto_schema is null then raise exception 'pgcrypto extension is not installed.'; end if;
  execute format('alter function public.publish_daily_trio_v16(date,jsonb) set search_path = public, %I',v_pgcrypto_schema);
end $$;
revoke all on function public.publish_daily_trio_v16(date,jsonb) from public,anon,authenticated;
grant execute on function public.publish_daily_trio_v16(date,jsonb) to service_role;

select public.apply_v16_2_3_backlog_dispositions();
select public.apply_v16_2_3_catalog_curation();
select public.refresh_measurement_types_v16_2_2();
select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

commit;
