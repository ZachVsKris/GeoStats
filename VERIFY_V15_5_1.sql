-- GeoStats v15.5.1 verification queries.

-- 1. These concepts should not be playable.
select id,title,source_indicator_code,enabled,eligible_daily,
       metadata->>'editorialOutcome' as editorial_outcome
from public.stat_categories
where upper(coalesce(source_indicator_code,'')) like any(array[
        '%FI.RES.XGLD.CD','%SP.URB.TOTL.MA.ZS','%CM.MKT.TRAD.CD'
      ])
   or lower(title) ~ '(total reserves minus gold|population in urban agglomerations? of more than 1 million|stocks traded,?[[:space:]]*total value|largest continuous land area)'
order by title;

-- Expected: every returned row has enabled=false, eligible_daily=false,
-- editorial_outcome=retired.

-- 2. No duplicate active source indicator should remain Daily-ready.
select source_organization,source_indicator_code,count(*) as active_copies,
       array_agg(id order by id) as category_ids
from public.stat_categories
where eligible_daily=true
  and nullif(trim(source_indicator_code),'') is not null
group by source_organization,source_indicator_code
having count(*)>1
order by active_copies desc,source_organization,source_indicator_code;

-- Expected: zero rows.

-- 3. Confirm rewritten titles when those categories exist.
select id,title,description
from public.stat_categories
where lower(title) in (
  'best access to safe drinking water',
  'highest share of stem graduates',
  'most potato exports'
)
order by title;

-- 4. Unscored generated boards should now use rules 12.1 after regeneration.
select challenge_date,difficulty,rules_version,count(*)
from public.daily_challenges
group by challenge_date,difficulty,rules_version
order by challenge_date desc,difficulty
limit 30;
