-- GeoStats v13.5 verification
-- Run after RUN_THIS_IN_SUPABASE_FOR_V13_5.sql.

-- 1. Credibility distribution and playable counts.
select
  credibility_status,
  count(*) as categories,
  count(*) filter (where enabled and eligible_daily) as playable
from public.stat_categories
group by credibility_status
order by credibility_status;

-- 2. This must return zero rows.
select id,title,credibility_score,credibility_status,enabled,eligible_daily
from public.stat_categories
where enabled and eligible_daily
  and (credibility_status='quarantined' or coalesce(credibility_score,0)<75);

-- 3. Internet use must be quarantined. Scientific articles must remain documented
-- as independently bibliometric rather than government self-report.
select source_indicator_code,title,credibility_score,credibility_status,evidence_label,
       comparability_risk,corroboration_status,enabled,eligible_daily,credibility_reason
from public.stat_categories
where source_indicator_code in ('IT.NET.USER.ZS','IP.JRN.ARTC.SC')
order by source_indicator_code;

-- 4. Natural Earth coastline must not be playable.
select id,title,credibility_score,credibility_status,enabled,eligible_daily,credibility_reason
from public.stat_categories
where source_organization='Natural Earth' and lower(title) like '%coastline%';

-- 5. Every playable category should have source and methodology links.
select id,title,source_organization,source_indicator_code,source_url,methodology_url
from public.stat_categories
where enabled and eligible_daily
  and (nullif(source_url,'') is null or nullif(methodology_url,'') is null)
order by source_organization,title;

-- 6. WHO vaccine names should identify the exact dose/series.
select source_indicator_code,title,description
from public.stat_categories
where source_organization='WHO'
  and source_indicator_code in ('WHS4_117','WHS8_110','WHS4_543')
order by source_indicator_code;

-- 7. Username onboarding schema and case-insensitive uniqueness.
select column_name,data_type,column_default,is_nullable
from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name='username_customized';

-- This must return zero rows.
select lower(username) as normalized_username,count(*)
from public.profiles
group by lower(username)
having count(*)>1;

-- 8. Existing accounts still awaiting a GeoStats username choice.
select count(*) as accounts_awaiting_username
from public.profiles
where username_customized=false;

-- 9. Source-level trust summary.
select source_organization,
       count(*) as catalog,
       count(*) filter (where enabled and eligible_daily) as playable,
       round(avg(credibility_score),1) as average_credibility,
       count(*) filter (where credibility_status='quarantined') as quarantined
from public.stat_categories
group by source_organization
order by playable desc,source_organization;
