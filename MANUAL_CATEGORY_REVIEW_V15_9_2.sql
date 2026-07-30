-- GeoStats v15.9.2 complete manual review export (read only)
-- Run after the automatic expansion and vetting workflow.
-- Includes every currently approved category plus every new v15.9 candidate.
select
  case
    when id like 'pew-religion:%'
      or id like 'faostat-fbs:%'
      or id like 'worldbank-expansion:%'
      or id='unescoheritage:all-sites'
    then 'new v15.9 candidate'
    else 'existing approved catalog'
  end as review_scope,
  id,
  effective_title,
  description,
  source_organization,
  source_indicator_code,
  unit,
  common_year,
  common_year_coverage,
  editorial_status,
  hard_gate_ready,
  computed_playable_v15,
  auto_vetting_recommendation,
  auto_vetting_score,
  auto_vetting_reason,
  auto_possible_duplicate_of,
  auto_title_similarity,
  auto_rank_correlation,
  auto_tie_share,
  player_source_url,
  methodology_url
from public.category_review_workbench_v15_9
where editorial_status='approved'
   or id like 'pew-religion:%'
   or id like 'faostat-fbs:%'
   or id like 'worldbank-expansion:%'
   or id='unescoheritage:all-sites'
order by
  review_scope desc,
  source_organization,
  auto_vetting_score desc nulls last,
  effective_title;
