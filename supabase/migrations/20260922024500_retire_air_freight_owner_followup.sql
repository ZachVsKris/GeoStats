begin;

update public.stat_categories
set metadata=jsonb_set(
      jsonb_set(coalesce(metadata,'{}'::jsonb),'{ownerRetired}','true'::jsonb,true),
      '{ownerRetirementReason}',to_jsonb('Removed from future play at the owner''s request on 2026-09-22.'::text),true
    ),
    updated_at=now()
where id='airFreight';

update public.stat_categories
set enabled=false,
    eligible_daily=false,
    review_status='rejected',
    curation_status='excluded',
    curation_reason='Removed from future play at the owner''s request on 2026-09-22.',
    curation_version='geostats-owner-comments-2026-09-22-v2',
    content_review_status='excluded',
    content_review_reason='Removed from future play at the owner''s request on 2026-09-22.',
    content_review_version='geostats-owner-comments-2026-09-22-v2',
    player_quality_status='blocked',
    player_quality_reason='Removed from future play at the owner''s request.',
    updated_at=now()
where id='airFreight';

do $verify$
begin
  if exists (
    select 1 from public.category_runtime_review_v16_2
    where id='airFreight' and (computed_playable_v16_2 or enabled or eligible_daily)
  ) then
    raise exception 'Air freight remains playable';
  end if;
  if (select count(*) from public.stat_categories where enabled and eligible_daily)<>344
    or (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2 and enabled and eligible_daily)<>344 then
    raise exception 'Owner-reviewed catalog must contain exactly 344 playable categories';
  end if;
end
$verify$;

commit;
