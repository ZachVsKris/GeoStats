-- Full manual review list: every approved category, with copy flags first.
select
  category_id,
  source_organization,
  source_indicator_code,
  playable,
  player_title,
  board_description,
  plain_language_description,
  technical_definition,
  unit,
  common_year,
  common_year_coverage,
  copy_flags,
  player_source_url,
  methodology_url
from public.category_manual_review_v15_7
order by
  (cardinality(copy_flags) > 0) desc,
  source_organization,
  player_title;
