begin;

-- Game cards use description fragments beneath titles, so terminal periods add
-- visual noise. Strip them from every playable card description while keeping
-- full source and technical explanations unchanged.
update public.stat_categories
set metadata=jsonb_set(
      coalesce(metadata,'{}'::jsonb),
      '{boardDescription}',
      to_jsonb(regexp_replace(metadata->>'boardDescription','[.]\s*$','','g')),
      true
    ),
    updated_at=now()
where enabled
  and eligible_daily
  and metadata->>'boardDescription' ~ '[.]\s*$';

do $$
begin
  if exists (
    select 1
    from public.category_runtime_review_v16_2
    where computed_playable_v16_2
      and metadata->>'boardDescription' ~ '[.]\s*$'
  ) then
    raise exception 'v16.2.8 playable card description still ends in a period';
  end if;

  if (select count(*) from public.category_runtime_review_v16_2 where computed_playable_v16_2) <> 323 then
    raise exception 'v16.2.8 card-description punctuation change altered the playable count';
  end if;
end $$;

commit;
