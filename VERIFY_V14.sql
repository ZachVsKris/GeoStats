-- GeoStats v14 verification
-- The first four checks must return zero rows.

select id,title from public.stat_categories
where enabled=true and eligible_daily=true
  and (coalesce(objective_status,'uncertain')<>'objective' or coalesce(player_quality_status,'blocked')='blocked');

select id,title from public.stat_categories
where enabled=true and eligible_daily=true
  and (coalesce(verifiability_score,0)<80 or coalesce(understandability_score,0)<70 or coalesce(fun_score,0)<55);

select id,title from public.stat_categories
where enabled=true and eligible_daily=true
  and (plain_language_description is null or length(btrim(plain_language_description))<12);

select id,title from public.stat_categories
where enabled=true and eligible_daily=true
  and (credibility_status='quarantined' or coalesce(credibility_score,0)<75);

-- Summary of the live warehouse after imports and review.
select source_organization,count(*) as candidates,
       count(*) filter(where enabled and eligible_daily) as playable,
       count(*) filter(where curation_status='pending') as awaiting_editorial_review,
       round(avg(verifiability_score),1) as avg_verifiability,
       round(avg(understandability_score),1) as avg_understandability,
       round(avg(fun_score),1) as avg_fun
from public.stat_categories
group by source_organization
order by candidates desc;
