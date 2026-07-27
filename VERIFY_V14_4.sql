-- GeoStats v14.4.0 verification

-- 1. The first row should show playable > 0 and separate exact/general counts.
select * from public.category_v144_overview;

-- 2. Inspect every category with its transparent computed decision.
select id,title,source_organization,computed_playable,player_source_status,
       playability_blockers,playability_warnings
from public.category_playability_v144
order by computed_playable desc,source_organization,title;

-- 3. These queries MUST return zero rows.
select id,title,player_source_status,player_source_url
from public.category_playability_v144
where computed_playable
  and (player_source_status not in ('exact','general')
       or not public.player_source_url_is_safe(player_source_url));

select id,title,review_status,curation_status,validation_status,content_review_status
from public.category_playability_v144
where computed_playable
  and (review_status <> 'approved'
       or (curation_status is not null and curation_status <> 'approved')
       or validation_status <> 'verified'
       or content_review_status <> 'approved');

select category_id,country_iso3,data_year,count(*)
from public.stat_observations
group by category_id,country_iso3,data_year
having count(*) > 1;

select * from public.stat_observation_integrity_v144
where invalid_country_codes > 0 or duplicate_category_country_year_keys > 0;

-- 4. Legacy booleans should agree after reconciliation. MUST return zero rows.
select id,title,computed_playable,enabled,eligible_daily
from public.category_playability_v144
where enabled is distinct from computed_playable
   or eligible_daily is distinct from computed_playable;

-- 5. Daily package health for the last 14 dates.
select challenge_date,
       count(*) as boards,
       count(distinct difficulty) as modes,
       array_agg(distinct difficulty order by difficulty) as difficulties
from public.daily_challenges
where challenge_date >= current_date - 14
group by challenge_date
having count(*) <> 3 or count(distinct difficulty) <> 3
order by challenge_date desc;

-- 6. Recent generator diagnostics.
select challenge_date,status,source,error_message,diagnostics,created_at
from public.daily_generation_runs
order by created_at desc
limit 20;
