-- GeoStats v15.8 verification. Read-only.
select
 to_regclass('public.v15_8_category_backup') as category_backup,
 to_regclass('public.v15_8_review_backup') as review_backup,
 to_regclass('public.v15_8_editorial_backup') as editorial_backup,
 to_regclass('public.v15_8_source_backup') as source_backup,
 to_regclass('public.v15_8_faostat_policy_decisions') as faostat_policy,
 to_regclass('public.category_auto_vetting_v15_8') as auto_vetting,
 to_regclass('public.category_review_workbench_v15_8') as workbench_view;

-- Must be zero.
select count(*) as playable_yield_or_productivity_categories
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id=queue.id
where queue.computed_playable_v15
and category.source_organization='FAOSTAT'
and lower(concat_ws(' ',queue.effective_title,category.description,category.unit)) ~
 '(yield|kg/ha|tonnes?/ha|per hectare|area harvested|harvested area|carcass|slaughter|per animal|output per animal)';

-- Clear livestock-population totals should remain available when their integrity gates pass.
select queue.id,queue.effective_title,category.source_indicator_code,category.unit,queue.computed_playable_v15
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id=queue.id
where category.source_organization='FAOSTAT' and category.source_indicator_code ~ ':5111$'
order by queue.effective_title;

-- City share wording.
select id,title,plain_language_description,metadata->>'boardDescription' as board_description
from public.stat_categories where source_indicator_code='EN.URB.LCTY';

-- Expansion candidates and automated recommendations.
select category.source_organization,
 count(*) as candidates,
 count(*) filter(where review.status='pending') as pending_manual_review,
 count(*) filter(where vetting.recommendation='approve') as auto_recommended_approve,
 count(*) filter(where vetting.recommendation='rewrite') as auto_recommended_rewrite,
 count(*) filter(where vetting.recommendation='duplicate') as auto_recommended_duplicate,
 count(*) filter(where vetting.recommendation='quarantine_data') as auto_quarantined,
 count(*) filter(where vetting.recommendation='retire') as auto_recommended_retire
from public.stat_categories category
join public.category_review_state review on review.category_id=category.id
left join public.category_auto_vetting_v15_8 vetting on vetting.category_id=category.id
where category.source_organization in(
 'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation',
 'UNESCO World Heritage Centre','FAO AQUASTAT','USGS Minerals','FAO Fisheries'
)
group by category.source_organization order by category.source_organization;

-- New categories must not become playable without manual approval. Must return zero rows.
select queue.id,queue.effective_title,queue.source_organization
from public.category_review_workbench_v15_8 queue
where queue.source_organization in(
 'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation',
 'UNESCO World Heritage Centre','FAO AQUASTAT','USGS Minerals','FAO Fisheries'
)
and queue.computed_playable_v15
and queue.editorial_status<>'approved';

-- Current totals.
select
 count(*) filter(where computed_playable_v15) as playable,
 count(*) filter(where editorial_status='approved') as approved,
 count(*) filter(where editorial_status='approved' and not computed_playable_v15) as approved_but_blocked,
 count(*) filter(where editorial_status='pending') as pending,
 count(*) filter(where hard_gate_ready) as integrity_ready
from public.category_review_queue_v15;
