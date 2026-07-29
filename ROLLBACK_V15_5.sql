-- Roll back GeoStats v15.5 catalog/editorial changes.
-- Imported source observations are not deleted. Unscored Daily boards deleted by
-- the installer are not restored because they can be regenerated.

begin;

drop view if exists public.category_catalog_review_v15_5;

drop trigger if exists stat_categories_v15_5_editorial_intake on public.stat_categories;
drop trigger if exists category_catalog_editorial_v15_5_apply on public.category_catalog_editorial_v15_5;

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
from public.v15_5_review_state_backup backup
where backup.category_id=review.category_id;

update public.stat_categories category
set title=coalesce(backup.category_state->>'title',category.title),
    short_title=backup.category_state->>'short_title',
    description=backup.category_state->>'description',
    plain_language_description=backup.category_state->>'plain_language_description',
    metadata=coalesce(backup.category_state->'metadata','{}'::jsonb),
    enabled=coalesce((backup.category_state->>'enabled')::boolean,false),
    eligible_daily=coalesce((backup.category_state->>'eligible_daily')::boolean,false),
    content_review_status=backup.category_state->>'content_review_status',
    content_review_reason=backup.category_state->>'content_review_reason',
    content_review_version=backup.category_state->>'content_review_version',
    player_quality_status=backup.category_state->>'player_quality_status',
    player_quality_reason=backup.category_state->>'player_quality_reason',
    updated_at=now()
from public.v15_5_category_backup backup
where backup.category_id=category.id;

select * from public.reconcile_category_playability_v15();

drop function if exists public.ensure_category_catalog_editorial_v15_5();
drop function if exists public.apply_category_catalog_editorial_v15_5();
drop table if exists public.category_similarity_pairs_v15_5;
drop table if exists public.category_catalog_editorial_v15_5;
drop table if exists public.category_normalization_policy_v15_5;

commit;
