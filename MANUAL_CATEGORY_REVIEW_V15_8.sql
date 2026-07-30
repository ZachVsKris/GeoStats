-- Complete v15.8 manual-review export: existing approved catalog plus all expansion candidates.
select
 queue.id as category_id,
 queue.source_organization,
 queue.source_indicator_code,
 queue.editorial_status,
 queue.computed_playable_v15 as playable,
 queue.effective_title as current_player_title,
 queue.recommended_title,
 category.metadata->>'boardDescription' as board_description,
 category.plain_language_description,
 category.technical_definition,
 category.unit,
 category.common_year,
 category.common_year_coverage,
 queue.effective_semantic_group,
 queue.auto_vetting_recommendation,
 queue.auto_vetting_score,
 queue.auto_vetting_reason,
 queue.auto_possible_duplicate_of,
 category.player_source_url,
 category.methodology_url
from public.category_review_workbench_v15_8 queue
join public.stat_categories category on category.id=queue.id
where queue.editorial_status='approved'
   or queue.source_organization in(
    'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation',
    'UNESCO World Heritage Centre','FAO AQUASTAT','USGS Minerals','FAO Fisheries'
   )
order by
 case queue.editorial_status when 'pending' then 0 else 1 end,
 queue.source_organization,
 queue.effective_title;
