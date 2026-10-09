-- Run after deploying placements-tapered-v1. Idempotent; never changes boards,
-- assignments, completion times, placement averages, or retired board formats.
begin;
lock table public.daily_scores in share row exclusive mode;

create temporary table tapered_recalculation on commit drop as
with supported as (
  select s.id, s.difficulty, s.score as previous_score, s.assignments,
    d.board_payload,
    jsonb_array_length(d.board_payload->'categories') as category_count,
    case s.difficulty
      when 'easy' then array[100,65,45,25]
      when 'normal' then array[100,70,45,25,10,0]
      when 'expert' then array[100,75,55,40,25,15,5,0]
    end as points
  from public.daily_scores s
  join public.daily_challenges d using (challenge_date,difficulty)
  where (s.difficulty='easy' and jsonb_array_length(d.board_payload->'bank')=4 and jsonb_array_length(d.board_payload->'categories')=4)
     or (s.difficulty='normal' and jsonb_array_length(d.board_payload->'bank')=6 and jsonb_array_length(d.board_payload->'categories')=4)
     or (s.difficulty='expert' and jsonb_array_length(d.board_payload->'bank')=8 and jsonb_array_length(d.board_payload->'categories')=6)
), placements as (
  select s.*, c->'category'->>'id' as category_id,
    chosen.rank as placement
  from supported s
  cross join lateral jsonb_array_elements(s.board_payload->'categories') c
  left join lateral (
    select ranked.* from (
      select o->>'countryId' as country_id,
        rank() over (order by
          case when c->'category'->>'direction'='high' then -(o->>'value')::numeric else (o->>'value')::numeric end
        )::integer as rank
      from jsonb_array_elements(c->'ranked') o
      where exists (select 1 from jsonb_array_elements(s.board_payload->'bank') b where b->>'id'=o->>'countryId')
    ) ranked
    where ranked.country_id = s.assignments->>(c->'category'->>'id')
  ) chosen on true
)
select id, difficulty, previous_score, category_count,
  sum(points[placement])::integer as new_score,
  count(placement)::integer as matched_categories,
  count(distinct assignments->>category_id)::integer as distinct_countries,
  (select count(*) from jsonb_object_keys(assignments))::integer as assignment_count
from placements
group by id,difficulty,previous_score,category_count,assignments;

do $$
begin
  if exists (select 1 from tapered_recalculation where
    matched_categories <> category_count or distinct_countries <> category_count
    or assignment_count <> category_count or new_score is null
    or new_score < 0 or new_score > category_count*100 or new_score%5 <> 0
  ) then
    raise exception 'A saved result cannot be exactly recalculated; no scores were changed.';
  end if;
end $$;

update public.daily_scores s
set score = r.new_score, scoring_version = 'placements-tapered-v1'
from tapered_recalculation r
where s.id = r.id and (s.score is distinct from r.new_score or s.scoring_version is distinct from 'placements-tapered-v1');

select difficulty, count(*) as recalculated_results,
  count(*) filter (where previous_score <> new_score) as changed_scores
from tapered_recalculation group by difficulty order by difficulty;
commit;
