begin;

-- Owner-directed removal: discard only unscored saved modes containing the
-- retired tropical-savanna category. Scored historical modes remain immutable
-- for score integrity, but the public application rejects retired categories
-- when deciding whether a stored Daily is current and playable.
delete from public.daily_challenges d
where exists (
  select 1
  from jsonb_array_elements(coalesce(d.board_payload->'categories','[]'::jsonb)) item
  where item->'category'->>'id'='koppen-geiger:tropical-savanna-share'
)
and not exists (
  select 1 from public.daily_scores s
  where s.challenge_date=d.challenge_date and s.difficulty=d.difficulty
);

do $$
begin
  if exists (
    select 1 from public.daily_challenges d
    where exists (
      select 1
      from jsonb_array_elements(coalesce(d.board_payload->'categories','[]'::jsonb)) item
      where item->'category'->>'id'='koppen-geiger:tropical-savanna-share'
    )
    and not exists (
      select 1 from public.daily_scores s
      where s.challenge_date=d.challenge_date and s.difficulty=d.difficulty
    )
  ) then
    raise exception 'unscored tropical-savanna Daily board survived removal';
  end if;
end $$;

commit;
