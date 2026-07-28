-- Roll back GeoStats v15.4 catalog decisions and runtime metadata.
begin;

update public.category_review_state review
set status=backup.review_state->>'status',
    political_self_reported=coalesce((backup.review_state->>'political_self_reported')::boolean,false),
    confusing=coalesce((backup.review_state->>'confusing')::boolean,false),
    esoteric=coalesce((backup.review_state->>'esoteric')::boolean,false),
    subjective_or_composite=coalesce((backup.review_state->>'subjective_or_composite')::boolean,false),
    stale_data=coalesce((backup.review_state->>'stale_data')::boolean,false),
    poor_coverage=coalesce((backup.review_state->>'poor_coverage')::boolean,false),
    duplicate_of=backup.review_state->>'duplicate_of',
    recommended_title=backup.review_state->>'recommended_title',
    semantic_group=backup.review_state->>'semantic_group',
    notes=backup.review_state->>'notes',
    reviewed_at=(backup.review_state->>'reviewed_at')::timestamptz,
    reviewed_by=(backup.review_state->>'reviewed_by')::uuid,
    updated_at=now()
from public.v15_4_review_state_backup backup
where backup.category_id=review.category_id;

update public.stat_categories category
set title=coalesce(backup.category_state->>'title',category.title),
    short_title=backup.category_state->>'short_title',
    metadata=coalesce(backup.category_state->'metadata','{}'::jsonb),
    quality_score=(backup.category_state->>'quality_score')::integer,
    enabled=coalesce((backup.category_state->>'enabled')::boolean,false),
    eligible_daily=coalesce((backup.category_state->>'eligible_daily')::boolean,false),
    updated_at=now()
from public.v15_4_category_backup backup
where backup.category_id=category.id;

select * from public.reconcile_category_playability_v15();
drop table if exists public.category_runtime_review_v15_4;

commit;
