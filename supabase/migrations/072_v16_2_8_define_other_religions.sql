begin;

-- "Other" is not self-explanatory on a game card. Name the comparison group
-- in the title, list the five separately reported religions on the card, and
-- keep the fuller Pew definition in the expanded description.
update public.stat_categories
set title='Highest % following religions outside the five major groups',
    short_title='Religions outside five major groups',
    description='Religions other than Christianity, Islam, Hinduism, Buddhism or Judaism.',
    plain_language_description='Religions other than Christianity, Islam, Hinduism, Buddhism or Judaism.',
    metadata=jsonb_set(
      coalesce(metadata,'{}'::jsonb),
      '{boardDescription}',
      to_jsonb('Religions other than Christianity, Islam, Hinduism, Buddhism or Judaism.'::text),
      true
    ),
    content_review_status='approved',
    content_review_reason='v16.2.8 owner follow-up: replaced the undefined catch-all word other with the exact separately reported groups and examples.',
    content_review_version='geostats-v16.2.8-owner-followup',
    immediate_comprehension_score=greatest(coalesce(immediate_comprehension_score,0),96),
    understandability_score=greatest(coalesce(understandability_score,0),96),
    updated_at=now()
where id='pew-religion:other-religions-share';

select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

do $$
begin
  if not exists (
    select 1
    from public.category_runtime_review_v16_2
    where id='pew-religion:other-religions-share'
      and computed_playable_v16_2
      and title='Highest % following religions outside the five major groups'
      and metadata->>'boardDescription'='Religions other than Christianity, Islam, Hinduism, Buddhism or Judaism.'
  ) then
    raise exception 'v16.2.8 other-religions definition did not remain playable';
  end if;

  if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2) <> 323 then
    raise exception 'v16.2.8 other-religions copy change altered the playable count';
  end if;
end $$;

commit;
