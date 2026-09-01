begin;

alter table public.category_review_state
  drop constraint if exists category_review_state_status_check;
alter table public.category_review_state
  add constraint category_review_state_status_check
  check (status in ('pending','approved','rejected','duplicate','needs_rewrite','needs_data_repair','needs_discussion'));

with decisions as (
  select id,
    case
      when blocker_class_v16_2='copy_or_semantic_rewrite' then 'needs_rewrite'
      when blocker_class_v16_2='duplicate' then 'duplicate'
      when blocker_class_v16_2 in (
        'ranking_completeness','source_audit_pending','substantive_data_failure','source_specific_quality'
      ) then 'needs_data_repair'
      else 'rejected'
    end as status,
    suggested_duplicate_of_v16_2 as duplicate_of,
    primary_blocker_v16_2 as reason
  from public.category_review_workbench_v16_2
  where review_status='needs_review'
)
insert into public.category_review_state(
  category_id,status,duplicate_of,notes,reviewed_at,updated_at
)
select id,status,case when status='duplicate' then duplicate_of else null end,
       concat('v16.3.0 finite backlog disposition: ',coalesce(reason,'did not clear the current activation gates.')),
       now(),now()
from decisions
on conflict(category_id) do update
set status=excluded.status,
    duplicate_of=excluded.duplicate_of,
    notes=concat_ws(E'\n',nullif(category_review_state.notes,''),excluded.notes),
    reviewed_at=excluded.reviewed_at,
    updated_at=excluded.updated_at;

with final_exclusions as (
  select category_id from public.category_review_state
  where status in ('rejected','duplicate')
)
update public.stat_categories c
set review_status='rejected',curation_status='excluded',content_review_status='excluded',
    curation_reason='v16.3.0 finite backlog decision: rejected or duplicate; no category-count padding.',
    content_review_reason='v16.3.0 finite backlog decision: rejected or duplicate; no category-count padding.',
    curation_version='geostats-v16.3.0-finite-backlog',
    content_review_version='geostats-v16.3.0-finite-backlog',
    enabled=false,eligible_daily=false,updated_at=now()
from final_exclusions x where c.id=x.category_id and c.review_status='needs_review';

select public.refresh_v16_2_runtime_catalog();

do $$
begin
  if exists (
    select 1 from public.category_review_workbench_v16_2
    where review_status='needs_review' and editorial_status='pending'
  ) then raise exception 'finite review backlog still contains pending editorial decisions'; end if;
end $$;

commit;
