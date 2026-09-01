begin;

-- Follow-up to the full icon review: fix substring collisions (pineapple /
-- apple, eggplant / egg, grapefruit / grape) and the remaining generic
-- fallbacks that do not communicate the subject of the card.
update public.stat_categories
set icon=case id
      when 'faostat-qcl-bananas-production-01312-5510-t' then '🍌'
      when 'faostat-qcl-eggplants-aubergines-production-01233-5510-t' then '🍆'
      when 'faostat-qcl-pomelos-and-grapefruits-production-01321-5510-t' then '🍊'
      when 'faostat-qcl-pineapples-production-01318-5510-t' then '🍍'
      when 'faostat-qcl-figs-production-01315-5510-t' then '🧺'
      when 'faostat-qcl-fruit-primary-production-f1738-5510-t' then '🍎'
      when 'faostat-qcl-plums-and-sloes-production-01346-5510-t' then '🍑'
      when 'faostat-qcl-unmanufactured-tobacco-production-01970-5510-t' then '🚬'
      else icon end,
    content_review_reason='v16.3.1 semantic icon follow-up.',
    content_review_version='geostats-v16.3.1-catalog-integrity',
    updated_at=now()
where id in (
  'faostat-qcl-bananas-production-01312-5510-t',
  'faostat-qcl-eggplants-aubergines-production-01233-5510-t',
  'faostat-qcl-pomelos-and-grapefruits-production-01321-5510-t',
  'faostat-qcl-pineapples-production-01318-5510-t',
  'faostat-qcl-figs-production-01315-5510-t',
  'faostat-qcl-fruit-primary-production-f1738-5510-t',
  'faostat-qcl-plums-and-sloes-production-01346-5510-t',
  'faostat-qcl-unmanufactured-tobacco-production-01970-5510-t'
);

update public.stat_categories
set icon='🚜',updated_at=now()
where id in ('agLand','worldbank-catalog:ag-lnd-crop-zs','worldbank-catalog:ag-lnd-arbl-ha-pc');

update public.stat_categories
set icon='💧',updated_at=now()
where id='worldbank-catalog:er-h2o-fwag-zs';

update public.stat_categories
set icon='🍽️',updated_at=now()
where id='faostat-fbs:calories';

update public.stat_categories
set icon=case id
      when 'worldbank-catalog:en-bir-thrd-no' then '🐦'
      when 'worldbank-catalog:en-fsh-thrd-no' then '🐟'
      when 'worldbank-catalog:en-mam-thrd-no' then '🐾'
      when 'worldbank-catalog:en-hpt-thrd-no' then '🌿'
      when 'worldbank-catalog:er-fsh-aqua-mt' then '🐟'
      when 'worldbank-catalog:er-fsh-capt-mt' then '🐟'
      when 'worldbank-catalog:er-fsh-prod-mt' then '🐟'
      else icon end,
    updated_at=now()
where id in (
  'worldbank-catalog:en-bir-thrd-no','worldbank-catalog:en-fsh-thrd-no',
  'worldbank-catalog:en-mam-thrd-no','worldbank-catalog:en-hpt-thrd-no',
  'worldbank-catalog:er-fsh-aqua-mt','worldbank-catalog:er-fsh-capt-mt',
  'worldbank-catalog:er-fsh-prod-mt'
);

update public.stat_categories
set family='Population',
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
      'broadDomain','demographics','knowledgeCluster','urbanization',
      'taxonomyVersion','geostats-v16.3.1'
    ),updated_at=now()
where id='worldbank-catalog:en-urb-mcty-tl-zs';

do $$
begin
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily
      and id in (
        'faostat-qcl-eggplants-aubergines-production-01233-5510-t',
        'faostat-qcl-pomelos-and-grapefruits-production-01321-5510-t',
        'faostat-qcl-pineapples-production-01318-5510-t'
      )
      and icon not in ('🍆','🍊','🍍')
  ) then raise exception 'v16.3.1 substring-collision icon repair failed'; end if;
  if (
    select count(*) from public.category_runtime_review_v16_2
    where computed_playable_v16_2 and enabled and eligible_daily and icon='🌾'
  )>10 then raise exception 'v16.3.1 semantic icon follow-up left generic grain icon overused'; end if;
  if not exists (
    select 1 from public.category_runtime_review_v16_2
    where id='worldbank-catalog:en-urb-mcty-tl-zs'
      and family='Population' and metadata->>'broadDomain'='demographics'
  ) then raise exception 'v16.3.1 urban-population taxonomy follow-up failed'; end if;
end $$;

commit;
