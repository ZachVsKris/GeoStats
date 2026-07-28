-- GeoStats v15.3 post-install verification

select * from public.category_review_overview_v15;

select
  source_organization,
  count(*) filter (where computed_playable_v15) as playable,
  count(*) filter (where editorial_status='approved') as approved,
  count(*) filter (where editorial_status in ('pending','needs_rewrite','needs_discussion')) as awaiting_review,
  count(*) filter (where hard_gate_ready) as hard_gate_ready
from public.category_review_queue_v15
group by source_organization
order by playable desc, source_organization;

select
  id,
  effective_title,
  editorial_status,
  computed_playable_v15,
  source_query
from public.category_review_queue_v15
where source_organization='FAOSTAT'
  and computed_playable_v15
order by quality_score desc
limit 25;

select
  id,
  effective_title,
  editorial_status,
  computed_playable_v15,
  v15_blockers
from public.category_review_queue_v15
where source_organization='Natural Earth'
order by computed_playable_v15 desc, effective_title;

select
  id,
  effective_title,
  editorial_status,
  computed_playable_v15,
  editorial_notes
from public.category_review_queue_v15
where source_organization='UNESCO UIS'
  and source_indicator_code in ('CR.MOD.1','CR.MOD.2','CR.MOD.3');

select
  id,
  effective_title,
  source_organization,
  v15_blockers,
  v15_warnings
from public.category_review_queue_v15
where editorial_status='approved'
  and not computed_playable_v15
order by source_organization, effective_title;
