-- GeoStats v15.8.1 focused FAOSTAT verification

-- 1. Yield/productivity must remain zero playable rows.
select
  queue.id,
  queue.effective_title,
  category.source_indicator_code,
  category.unit,
  queue.editorial_status,
  queue.hard_gate_ready,
  queue.computed_playable_v15
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id = queue.id
where queue.computed_playable_v15
  and category.source_organization = 'FAOSTAT'
  and lower(concat_ws(
    ' ', queue.effective_title, category.description,
    category.plain_language_description, category.technical_definition,
    category.unit
  )) ~ '(yield|kg/ha|tonnes?/ha|per hectare|area harvested|harvested area|carcass|slaughter|per animal|output per animal|producing animals|milk animals|laying hens?)'
order by queue.effective_title;

-- 2. Individual live-animal population totals should be approved/playable when
-- their independent integrity gates pass. Combined aggregates stay in rewrite.
select
  queue.id,
  queue.effective_title,
  category.source_indicator_code,
  category.unit,
  queue.editorial_status,
  queue.hard_gate_ready,
  queue.computed_playable_v15
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id = queue.id
where category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$'
order by
  case when category.source_indicator_code ~ '(F1746|F1749):5111$' then 1 else 0 end,
  queue.effective_title;

-- 3. Summary.
select
  count(*) filter (
    where queue.computed_playable_v15
      and category.source_indicator_code ~ ':5111$'
  ) as playable_livestock_populations,
  count(*) filter (
    where queue.editorial_status = 'needs_rewrite'
      and category.source_indicator_code ~ '(F1746|F1749):5111$'
  ) as combined_aggregates_held_for_review
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id = queue.id
where category.source_organization = 'FAOSTAT';
