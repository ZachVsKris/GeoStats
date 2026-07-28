-- GeoStats v15.3 rollback
-- Restores the category and review fields changed by the v15.3 migration.

begin;

update public.category_review_state review
set status = coalesce(backup.review_state->>'status', review.status),
    political_self_reported = coalesce((backup.review_state->>'political_self_reported')::boolean, review.political_self_reported),
    confusing = coalesce((backup.review_state->>'confusing')::boolean, review.confusing),
    esoteric = coalesce((backup.review_state->>'esoteric')::boolean, review.esoteric),
    subjective_or_composite = coalesce((backup.review_state->>'subjective_or_composite')::boolean, review.subjective_or_composite),
    stale_data = coalesce((backup.review_state->>'stale_data')::boolean, review.stale_data),
    poor_coverage = coalesce((backup.review_state->>'poor_coverage')::boolean, review.poor_coverage),
    duplicate_of = backup.review_state->>'duplicate_of',
    recommended_title = backup.review_state->>'recommended_title',
    semantic_group = backup.review_state->>'semantic_group',
    notes = backup.review_state->>'notes',
    reviewed_by = nullif(backup.review_state->>'reviewed_by','')::uuid,
    reviewed_at = nullif(backup.review_state->>'reviewed_at','')::timestamptz,
    updated_at = now()
from public.v15_3_review_state_backup backup
where backup.category_id = review.category_id;

update public.stat_categories category
set title = coalesce(backup.category_state->>'title', category.title),
    short_title = backup.category_state->>'short_title',
    description = coalesce(backup.category_state->>'description', category.description),
    plain_language_description = backup.category_state->>'plain_language_description',
    unit = coalesce(backup.category_state->>'unit', category.unit),
    source_query = coalesce(backup.category_state->'source_query', category.source_query),
    player_quality_status = backup.category_state->>'player_quality_status',
    player_quality_reason = backup.category_state->>'player_quality_reason',
    updated_at = now()
from public.v15_3_category_backup backup
where backup.category_id = category.id;

select * from public.reconcile_category_playability_v15();

commit;
