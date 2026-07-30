-- Roll back v15.8 catalog-policy and source-registration changes.
-- Revert application code separately. Imported post-v15.8 candidate rows are
-- retained as Pending for auditability rather than destructively deleted.
begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.8.0-expansion-intake'));

do $$
begin
  if to_regclass('public.v15_8_category_backup') is null
     or to_regclass('public.v15_8_review_backup') is null
     or to_regclass('public.v15_8_editorial_backup') is null
     or to_regclass('public.v15_8_source_backup') is null then
    raise exception 'v15.8 backup tables are incomplete; rollback stopped.';
  end if;
end $$;

update public.stat_categories category
set title=backup.category_state->>'title',
    short_title=backup.category_state->>'short_title',
    description=backup.category_state->>'description',
    plain_language_description=backup.category_state->>'plain_language_description',
    metadata=coalesce(backup.category_state->'metadata','{}'::jsonb),
    enabled=coalesce((backup.category_state->>'enabled')::boolean,false),
    eligible_daily=coalesce((backup.category_state->>'eligible_daily')::boolean,false),
    updated_at=coalesce(nullif(backup.category_state->>'updated_at','')::timestamptz,now())
from public.v15_8_category_backup backup
where category.id=backup.category_id;

update public.category_review_state review
set status=backup.review_state->>'status',
    political_self_reported=coalesce((backup.review_state->>'political_self_reported')::boolean,false),
    confusing=coalesce((backup.review_state->>'confusing')::boolean,false),
    esoteric=coalesce((backup.review_state->>'esoteric')::boolean,false),
    subjective_or_composite=coalesce((backup.review_state->>'subjective_or_composite')::boolean,false),
    stale_data=coalesce((backup.review_state->>'stale_data')::boolean,false),
    poor_coverage=coalesce((backup.review_state->>'poor_coverage')::boolean,false),
    duplicate_of=nullif(backup.review_state->>'duplicate_of',''),
    recommended_title=backup.review_state->>'recommended_title',
    semantic_group=backup.review_state->>'semantic_group',
    notes=backup.review_state->>'notes',
    reviewed_at=nullif(backup.review_state->>'reviewed_at','')::timestamptz,
    reviewed_by=nullif(backup.review_state->>'reviewed_by','')::uuid,
    updated_at=now()
from public.v15_8_review_backup backup
where review.category_id=backup.category_id;

update public.category_catalog_editorial_v15_6 editorial
set original_title=backup.editorial_state->>'original_title',
    player_title=backup.editorial_state->>'player_title',
    player_description=backup.editorial_state->>'player_description',
    editorial_outcome=backup.editorial_state->>'editorial_outcome',
    decision_reason=backup.editorial_state->>'decision_reason',
    preferred_category_id=nullif(backup.editorial_state->>'preferred_category_id',''),
    broad_domain=backup.editorial_state->>'broad_domain',
    knowledge_cluster=backup.editorial_state->>'knowledge_cluster',
    strategy_family=backup.editorial_state->>'strategy_family',
    decision_source=backup.editorial_state->>'decision_source',
    reviewed_at=coalesce(nullif(backup.editorial_state->>'reviewed_at','')::timestamptz,now())
from public.v15_8_editorial_backup backup
where editorial.category_id=backup.category_id;

-- Remove source registrations created by v15.8 and restore any pre-existing rows.
delete from public.data_sources source
using public.v15_8_source_backup backup
where source.id=backup.source_id and not backup.existed_before;

update public.data_sources source
set name=backup.source_state->>'name',
    status=backup.source_state->>'status',
    description=backup.source_state->>'description',
    display_order=(backup.source_state->>'display_order')::integer,
    metadata=coalesce(backup.source_state->'metadata','{}'::jsonb),
    created_at=(backup.source_state->>'created_at')::timestamptz,
    updated_at=(backup.source_state->>'updated_at')::timestamptz
from public.v15_8_source_backup backup
where source.id=backup.source_id and backup.existed_before;

-- Categories imported after the backup remain available for review but not play.
update public.category_review_state review
set status='pending',reviewed_at=null,reviewed_by=null,updated_at=now()
from public.stat_categories category
where review.category_id=category.id
and category.id not in(select category_id from public.v15_8_category_backup)
and category.source_organization in(
 'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation',
 'UNESCO World Heritage Centre','FAO AQUASTAT','USGS Minerals','FAO Fisheries'
);

update public.stat_categories category
set enabled=false,eligible_daily=false,updated_at=now()
where category.id not in(select category_id from public.v15_8_category_backup)
and category.source_organization in(
 'Pew Research Center','Smithsonian GVP','USGS','ESA WorldCover','HydroSHEDS','Global Elevation',
 'UNESCO World Heritage Centre','FAO AQUASTAT','USGS Minerals','FAO Fisheries'
);

-- Restore only Daily boards removed by the v15.8 installer.
insert into public.daily_challenges
select archive.* from public.daily_challenge_archive_v15_8 archive
on conflict(challenge_date,difficulty) do update set
 seed=excluded.seed,
 encoded_board=excluded.encoded_board,
 board_payload=excluded.board_payload,
 board_hash=excluded.board_hash,
 dataset_version=excluded.dataset_version,
 rules_version=excluded.rules_version,
 category_set_version=excluded.category_set_version,
 created_at=excluded.created_at;

select * from public.reconcile_category_playability_v15();
commit;

select
 (select count(*) from public.v15_8_category_backup) as restored_categories,
 (select count(*) from public.v15_8_review_backup) as restored_review_states,
 (select count(*) from public.v15_8_editorial_backup) as restored_editorial_states,
 (select count(*) from public.daily_challenge_archive_v15_8) as restored_daily_boards;
