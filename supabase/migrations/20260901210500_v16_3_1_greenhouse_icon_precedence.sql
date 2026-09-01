begin;

-- Greenhouse card copy mentions emissions excluding land-use and forestry.
-- The broad forest matcher must not turn that explanatory phrase into a tree
-- icon, so persist the reviewed emissions icon at the data boundary too.
update public.stat_categories
set icon='🌫️',
    content_review_reason='v16.3.1 greenhouse icon precedence review.',
    content_review_version='geostats-v16.3.1-catalog-integrity',
    updated_at=now()
where id in (
  'worldbank-catalog:en-ghg-all-mt-ce-ar5',
  'worldbank-catalog:en-ghg-all-pc-ce-ar5',
  'worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5'
);

do $$
begin
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where id in (
      'worldbank-catalog:en-ghg-all-mt-ce-ar5',
      'worldbank-catalog:en-ghg-all-pc-ce-ar5',
      'worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5'
    ) and computed_playable_v16_2 and enabled and eligible_daily and icon<>'🌫️'
  ) then raise exception 'v16.3.1 greenhouse icon precedence repair failed'; end if;
end $$;

commit;
