-- GeoStats v14.3.1 verification
-- Run after RUN_THIS_IN_SUPABASE_FOR_V14_3_1.sql.

select * from public.category_content_link_overview;

-- Every playable category must pass the complete content-and-link gate.
select id,title,source_organization,content_review_status,player_source_status,
       immediate_comprehension_score,gameplay_interest_score,link_quality_score,
       enabled,eligible_daily
from public.stat_categories
where (enabled or eligible_daily)
  and (
    content_review_status <> 'approved'
    or player_source_status <> 'exact'
    or player_source_url is null
    or not public.player_source_url_is_safe(player_source_url)
    or coalesce(immediate_comprehension_score,0) < 80
    or coalesce(gameplay_interest_score,0) < 65
    or coalesce(link_quality_score,0) < 90
  );
-- Expected: 0 rows.

-- Confirm the three categories specifically flagged by the product review are excluded.
select source_organization,source_indicator_code,title,content_review_status,
       content_review_reason,enabled,eligible_daily
from public.stat_categories
where (source_organization,source_indicator_code) in (
  ('ILOSTAT','EMP_2WAP_SEX_AGE_RT_A'),
  ('ILOSTAT','SDG_1041_NOC_RT_A'),
  ('ILOSTAT','GDP_205U_NOC_NB_A')
);
-- Expected: all three content_review_status = excluded and both booleans false.

-- World Bank player links should be the readable indicator pages, never API URLs.
select id,title,source_indicator_code,player_source_url,player_source_status,link_quality_score
from public.stat_categories
where source_organization='World Bank' and content_review_status='approved'
order by title;

-- Categories awaiting a provider-specific exact human-readable page remain fail-closed.
select * from public.category_content_link_issues limit 100;

-- Source integrity and semantic board checks remain active from v14.2/v14.3.
select * from public.data_integrity_overview;
select * from public.board_semantic_conflicts limit 100;
