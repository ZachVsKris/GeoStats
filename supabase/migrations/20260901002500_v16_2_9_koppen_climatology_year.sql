begin;

-- The stored observation year is the end of the 1991-2020 climate normal.
-- Keep the gameplay freshness floor aligned with that documented temporal scope.
update public.stat_categories
set minimum_year=2020,
    updated_at=now()
where id like 'koppen-geiger:%'
  and minimum_year is distinct from 2020;

commit;
