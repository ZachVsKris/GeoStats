-- Replace the ambiguous historical `needs_discussion` bucket with an actionable
-- disposition. No category is promoted by this migration.
with decisions as (
  select
    w.id,
    case
      when w.blocker_class_v16_2 = 'copy_or_semantic_rewrite' then 'needs_rewrite'
      when w.blocker_class_v16_2 in (
        'ranking_completeness',
        'source_audit_pending',
        'source_specific_quality',
        'substantive_data_failure'
      ) then 'needs_data_repair'
      else 'rejected'
    end as final_status
  from public.category_review_workbench_v16_2 w
  where w.editorial_status = 'needs_discussion'
)
update public.category_review_state r
set status = d.final_status,
    duplicate_of = null,
    notes = concat_ws(
      E'\n',
      nullif(r.notes, ''),
      'v16.3.0 finite backlog disposition.'
    ),
    reviewed_at = now(),
    updated_at = now()
from decisions d
where r.category_id = d.id;
