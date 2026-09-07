begin;
create function public.save_category_reviews_v16_3_4(p_reviewer uuid,p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path='' set statement_timeout='300s' as $$
declare previous public.category_review_state;
declare desired public.category_review_state;
declare saved public.category_review_state;
declare presentation jsonb;
declare patch jsonb;
declare change jsonb;
declare event jsonb;
declare events jsonb := '[]'::jsonb;
declare results jsonb := '[]'::jsonb;
declare detail jsonb;
declare p_category_id text;
declare p_expected_updated_at timestamptz;
begin
  if p_reviewer is null or not exists(select 1 from public.app_admins where user_id=p_reviewer) then
    raise exception 'Administrator required' using errcode='42501';
  end if;
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes) not between 1 and 500 then
    raise exception 'Expected 1 to 500 category changes' using errcode='22023';
  end if;
  if (select count(distinct c->>'category_id') from jsonb_array_elements(p_changes) c)<>jsonb_array_length(p_changes) then
    raise exception 'Category IDs must be present and unique' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('geostats-v16.3.4-runtime-catalog'));
  for change in select value from jsonb_array_elements(p_changes) loop
    p_category_id:=change->>'category_id';
    p_expected_updated_at:=(change->>'expected_updated_at')::timestamptz;
    patch:=coalesce(change->'patch','{}'::jsonb);
    presentation:=coalesce(change->'presentation','{}'::jsonb);
  if jsonb_typeof(patch)<>'object' or patch-array['status','political_self_reported','confusing','esoteric','subjective_or_composite','stale_data','poor_coverage','duplicate_of','recommended_title','semantic_group','notes']<>'{}'::jsonb then
    raise exception 'Unsupported review field' using errcode='22023';
  end if;
  if jsonb_typeof(presentation)<>'object' or presentation-array['board_description']<>'{}'::jsonb then
    raise exception 'Unsupported presentation field' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('geostats-v16.3.4-runtime-catalog'));
  select * into previous from public.category_review_state where category_id=p_category_id for update;
  if not found then raise exception 'Category not found' using errcode='P0002'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then
    raise exception 'Category changed while being reviewed. Reload and retry.' using errcode='40001';
  end if;
  desired := jsonb_populate_record(previous,patch);
  if desired.status='approved' and (desired.political_self_reported or desired.confusing or desired.esoteric or desired.subjective_or_composite or desired.stale_data or desired.poor_coverage or desired.duplicate_of is not null) then
    raise exception 'Clear blocking flags before approval' using errcode='22023';
  end if;
  if desired.duplicate_of=p_category_id or (desired.status='duplicate' and desired.duplicate_of is null) then
    raise exception 'A duplicate needs a different preferred category' using errcode='22023';
  end if;
  presentation := case when presentation ? 'board_description' then jsonb_build_object('metadata',jsonb_build_object('boardDescription',presentation->'board_description','boardDescriptionReviewedAt',now(),'boardDescriptionReviewedBy',p_reviewer)) else '{}'::jsonb end;
  if patch ? 'recommended_title' and nullif(desired.recommended_title,'') is not null then
    presentation := presentation || jsonb_build_object('title',desired.recommended_title,'short_title',left(desired.recommended_title,70));
  end if;
  if patch ? 'semantic_group' and nullif(desired.semantic_group,'') is not null then
    presentation := presentation || jsonb_build_object('semantic_family',desired.semantic_group,'metadata',coalesce(presentation->'metadata','{}'::jsonb)||jsonb_build_object('strategyFamily',desired.semantic_group));
  end if;
  insert into public.category_review_contracts_v16_3_4 as c(category_id,review_patch,presentation_patch)
  values(p_category_id,patch,presentation)
  on conflict(category_id) do update set review_patch=c.review_patch||excluded.review_patch,
    presentation_patch=c.presentation_patch||excluded.presentation_patch||jsonb_build_object('metadata',coalesce(c.presentation_patch->'metadata','{}'::jsonb)||coalesce(excluded.presentation_patch->'metadata','{}'::jsonb)),
    revision=c.revision+1,updated_at=now();
  update public.category_review_state set
    status=desired.status,political_self_reported=desired.political_self_reported,confusing=desired.confusing,
    esoteric=desired.esoteric,subjective_or_composite=desired.subjective_or_composite,stale_data=desired.stale_data,
    poor_coverage=desired.poor_coverage,duplicate_of=desired.duplicate_of,recommended_title=desired.recommended_title,
    semantic_group=desired.semantic_group,notes=desired.notes,
    reviewed_by=case when desired.status='pending' then null else p_reviewer end,
    reviewed_at=case when desired.status='pending' then null else now() end,updated_at=now()
  where category_id=p_category_id;
  -- Apply copy before recomputing assessments, never after publication.
  update public.stat_categories set
    review_status=case when desired.status='approved' then 'approved' when desired.status in ('rejected','duplicate') then 'rejected' else 'needs_review' end,
    curation_status=case when desired.status='approved' then 'approved' when desired.status in ('rejected','duplicate') then 'excluded' else 'pending' end,
    content_review_status=case when desired.status='approved' then 'approved' when desired.status in ('rejected','duplicate') then 'excluded' else 'pending' end,
    player_quality_status=case when desired.status='approved' then 'approved' when desired.status in ('rejected','duplicate') then 'blocked' else 'caution' end
  where id=p_category_id;

    events:=events||jsonb_build_array(jsonb_build_object('category_id',p_category_id,'previous',to_jsonb(previous),'status',desired.status,'patch',patch,'presentation',presentation));
  end loop;
  -- Exactly one refresh for the entire batch, in the same transaction.
  perform public.refresh_v16_2_runtime_catalog();
  for event in select value from jsonb_array_elements(events) loop
    select * into saved from public.category_review_state where category_id=event->>'category_id';
    if saved.status is distinct from event->>'status' or not (to_jsonb(saved) @> (event->'patch')) then
      raise exception 'Decision conflicts with a protected product exclusion' using errcode='22023';
    end if;
    insert into public.category_review_events_v15(category_id,reviewer_user_id,previous_state,next_state)
    values(saved.category_id,p_reviewer,event->'previous',to_jsonb(saved)||jsonb_build_object('presentation',event->'presentation'));
    select to_jsonb(v) into detail from public.category_review_workbench_v16_2 v where id=saved.category_id;
    results:=results||jsonb_build_array(detail);
  end loop;
  return results;
end;
$$;
revoke all on function public.save_category_reviews_v16_3_4(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_category_reviews_v16_3_4(uuid,jsonb) to service_role;
create or replace function public.save_category_review_v16_3_4(
  p_category_id text,p_reviewer uuid,p_patch jsonb,p_expected_updated_at timestamptz,p_presentation jsonb default '{}'::jsonb
)
returns jsonb language sql security invoker set search_path='' set statement_timeout='300s' as $$
  select public.save_category_reviews_v16_3_4(p_reviewer,jsonb_build_array(jsonb_build_object(
    'category_id',p_category_id,'patch',p_patch,'expected_updated_at',p_expected_updated_at,'presentation',p_presentation
  )))->0;
$$;
commit;
