-- GeoStats v15.9.1: revised geography, clarity, mobile-release, and selective-board safeguards
-- Prerequisite: v15.9 integrated expansion migration.
-- Safe to rerun. Historical scored boards and immutable snapshots remain intact.

begin;
select pg_advisory_xact_lock(hashtext('geostats-v15.9.1-revised-safeguards'));

do $$
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'v15.9.1 stopped: category_review_queue_v15 is missing.';
  end if;
  if to_regprocedure('public.reconcile_category_playability_v15()') is null then
    raise exception 'v15.9.1 stopped: reconcile_category_playability_v15() is missing.';
  end if;
  if to_regclass('public.daily_challenges') is null or to_regclass('public.daily_scores') is null then
    raise exception 'v15.9.1 stopped: Daily board tables are missing.';
  end if;
end $$;

-- Full pre-change snapshots make the migration reversible without guessing which
-- rows were touched by clarity, semantic, or geography policy.
create table if not exists public.v15_9_1_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_9_1_category_backup(category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict(category_id) do nothing;

create table if not exists public.v15_9_1_review_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v15_9_1_review_backup(category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict(category_id) do nothing;

create table if not exists public.v15_9_1_retired_category_ids (
  category_id text primary key,
  reason text not null,
  recorded_at timestamptz not null default now()
);

create table if not exists public.v15_9_1_invalid_board_category_ids (
  category_id text primary key,
  reason text not null,
  recorded_at timestamptz not null default now()
);

-- Shape and position concepts were distorted by joining distant territories to
-- an administering sovereign. These exact legacy IDs remain decodable in scored
-- board snapshots but cannot enter new play.
insert into public.v15_9_1_retired_category_ids(category_id, reason)
select category.id,
       'Natural Earth shape/position concept retired pending a separately validated principal-landmass methodology.'
from public.stat_categories category
where lower(coalesce(category.source_organization,'')) = 'natural earth'
  and lower(coalesce(category.source_indicator_code,'')) in (
    'largest-geographic-span',
    'largest-north-south-span',
    'largest-east-west-span',
    'northernmost-country',
    'southernmost-country',
    'farthest-from-equator',
    'most-separate-land-areas',
    'most-large-land-areas'
  )
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

-- Explicitly retire the unreadable young-adult Findex variant.
insert into public.v15_9_1_retired_category_ids(category_id, reason)
select category.id,
       'Overqualified Findex subgroup title retired; retain the clear all-adults account-ownership measure.'
from public.stat_categories category
where category.source_indicator_code = 'FX.OWN.TOTL.YG.ZS'
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

update public.category_review_state review
set status='rejected', duplicate_of=null, recommended_title=null,
    notes=concat_ws(E'\n', nullif(review.notes,''), retired.reason),
    updated_at=now()
from public.v15_9_1_retired_category_ids retired
where review.category_id=retired.category_id;

update public.stat_categories category
set enabled=false,
    eligible_daily=false,
    metadata=coalesce(category.metadata,'{}'::jsonb)
      || jsonb_build_object('catalogTier','quarantined','retiredByV15_9_1',retired.reason),
    updated_at=now()
from public.v15_9_1_retired_category_ids retired
where category.id=retired.category_id;

-- Similar Findex demographic variants are held for rewrite rather than silently
-- remaining playable. The uncomplicated all-adults measure is retained.
update public.category_review_state review
set status='needs_rewrite', duplicate_of=null,
    notes=concat_ws(E'\n', nullif(review.notes,''),
      'v15.9.1 clarity gate: subgroup-specific combined-provider account-ownership wording requires a shorter distinct player concept.'),
    updated_at=now()
from public.stat_categories category
where review.category_id=category.id
  and category.source_indicator_code ~ '^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$'
  and review.status <> 'rejected';

update public.stat_categories category
set enabled=false, eligible_daily=false,
    metadata=coalesce(category.metadata,'{}'::jsonb)
      || '{"catalogTier":"pending","clarityGateV15_9_1":"findex-subgroup-rewrite"}'::jsonb,
    updated_at=now()
where category.source_indicator_code ~ '^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$';

-- Global copy guardrail: hold long or generic approved cards for editorial rewrite.
create table if not exists public.v15_9_1_unclear_copy(
  category_id text primary key,
  recorded_at timestamptz not null default now()
);
delete from public.v15_9_1_unclear_copy;
insert into public.v15_9_1_unclear_copy(category_id)
select category.id
from public.stat_categories category
join public.category_review_state review on review.category_id=category.id
where review.status='approved'
  and (
    char_length(trim(category.title)) > 96
    or cardinality(regexp_split_to_array(trim(category.title),'\s+')) > 16
    or (
      char_length(trim(category.title)) > 68
      and coalesce(category.plain_language_description, category.description, '')
        ~* '^(compare countries using|compare the official country value|official country value for this measure)'
    )
  );

update public.category_review_state review
set status='needs_rewrite',
    notes=concat_ws(E'\n', nullif(review.notes,''),
      'v15.9.1 clarity gate: title/description is too long or generic for a mobile game card.'),
    updated_at=now()
where review.category_id in (select category_id from public.v15_9_1_unclear_copy);

-- Source semantics outrank titles: blocked FAOSTAT elements remain rejected even
-- when a stale title incorrectly says "produced".
create table if not exists public.v15_9_1_blocked_faostat(
  category_id text primary key,
  recorded_at timestamptz not null default now()
);
delete from public.v15_9_1_blocked_faostat;
insert into public.v15_9_1_blocked_faostat(category_id)
select category.id
from public.stat_categories category
where lower(coalesce(category.source_organization,''))='faostat'
  and coalesce(category.source_indicator_code,'') ~* '^QCL:'
  and regexp_replace(
        regexp_replace(coalesce(category.source_indicator_code,''), '^.*:', ''),
        '[^0-9]', '', 'g'
      ) in ('5312','5320','5412','5417');

update public.category_review_state review
set status='rejected', duplicate_of=null, recommended_title=null,
    notes=concat_ws(E'\n', nullif(review.notes,''),
      'v15.9.1 semantic consistency: source element is yield, area, slaughter/carcass, or productivity and cannot be made playable by title wording.'),
    updated_at=now()
where review.category_id in (select category_id from public.v15_9_1_blocked_faostat);

update public.stat_categories category
set enabled=false, eligible_daily=false,
    metadata=coalesce(category.metadata,'{}'::jsonb)
      || '{"catalogTier":"quarantined","faostatSemanticGateV15_9_1":"blocked-source-element"}'::jsonb,
    updated_at=now()
where category.id in (select category_id from public.v15_9_1_blocked_faostat);

-- Static geography carries a pinned release label, not a fake observation year.
update public.stat_categories category
set metadata=coalesce(category.metadata,'{}'::jsonb)
      || jsonb_build_object(
        'referenceLabel', coalesce(nullif(category.dataset_release,''), 'Natural Earth v5.1.1'),
        'showObservationYear', false,
        'staticGeography', true,
        'territoryPolicy', 'Use ISO country identity before administering sovereign; separately coded dependencies are not unioned into the sovereign geometry.'
      ),
    updated_at=now()
where lower(coalesce(category.source_organization,''))='natural earth';

-- Any category newly made ineligible by this release invalidates an unplayed
-- current/future board. This includes prior UNESCO UIS cleanup and blocked source
-- semantics, not only the two explicitly retired examples.
delete from public.v15_9_1_invalid_board_category_ids;

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category_id, reason from public.v15_9_1_retired_category_ids
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category.id, 'UNESCO UIS is retired from new gameplay in v15.9.'
from public.stat_categories category
where lower(coalesce(category.source_organization,''))='unesco uis'
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category_id, 'FAOSTAT source element is blocked independently of player-facing wording.'
from public.v15_9_1_blocked_faostat
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category_id, 'Player-facing copy is held for rewrite by the v15.9.1 clarity gate.'
from public.v15_9_1_unclear_copy
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

insert into public.v15_9_1_invalid_board_category_ids(category_id, reason)
select category.id, 'Findex subgroup wording is held for rewrite by the v15.9.1 clarity gate.'
from public.stat_categories category
where category.source_indicator_code ~ '^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$'
on conflict(category_id) do update set reason=excluded.reason, recorded_at=now();

select public.reconcile_category_playability_v15();

-- Archive and delete only unscored current/future boards that actually contain
-- an invalidated category. Scored historical boards are never selected.
create table if not exists public.daily_challenge_archive_v15_9_1
  (like public.daily_challenges including all);

create table if not exists public.v15_9_1_removed_daily_challenges (
  challenge_date date not null,
  difficulty text not null,
  invalid_category_ids text[] not null default '{}',
  removed_at timestamptz not null default now(),
  primary key(challenge_date,difficulty)
);

create table if not exists public.v15_9_1_affected_boards (
  challenge_date date not null,
  difficulty text not null,
  invalid_ids text[] not null default '{}',
  recorded_at timestamptz not null default now(),
  primary key(challenge_date,difficulty)
);
delete from public.v15_9_1_affected_boards;
insert into public.v15_9_1_affected_boards(challenge_date,difficulty,invalid_ids)
select challenge.challenge_date,
       challenge.difficulty,
       array_agg(distinct invalid.category_id order by invalid.category_id) as invalid_ids
from public.daily_challenges challenge
cross join lateral jsonb_array_elements(coalesce(challenge.board_payload->'categories','[]'::jsonb)) item
join public.v15_9_1_invalid_board_category_ids invalid
  on invalid.category_id = item->'category'->>'id'
where challenge.challenge_date >= current_date
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
      and score.difficulty=challenge.difficulty
  )
group by challenge.challenge_date, challenge.difficulty;

insert into public.daily_challenge_archive_v15_9_1
select challenge.*
from public.daily_challenges challenge
join public.v15_9_1_affected_boards affected
  on affected.challenge_date=challenge.challenge_date
 and affected.difficulty=challenge.difficulty
on conflict(challenge_date,difficulty) do update set
  seed=excluded.seed,
  encoded_board=excluded.encoded_board,
  board_payload=excluded.board_payload,
  board_hash=excluded.board_hash,
  dataset_version=excluded.dataset_version,
  rules_version=excluded.rules_version,
  category_set_version=excluded.category_set_version,
  created_at=excluded.created_at;

insert into public.v15_9_1_removed_daily_challenges(challenge_date,difficulty,invalid_category_ids)
select challenge_date,difficulty,invalid_ids
from public.v15_9_1_affected_boards
on conflict(challenge_date,difficulty) do update set
  invalid_category_ids=excluded.invalid_category_ids,
  removed_at=now();

delete from public.daily_challenges challenge
using public.v15_9_1_affected_boards affected
where challenge.challenge_date=affected.challenge_date
  and challenge.difficulty=affected.difficulty
  and challenge.challenge_date >= current_date
  and not exists (
    select 1 from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
      and score.difficulty=challenge.difficulty
  );

commit;

select
  count(*) filter(where computed_playable_v15) as playable,
  count(*) filter(where editorial_status='approved') as approved,
  count(*) filter(where editorial_status='approved' and not computed_playable_v15) as approved_but_blocked,
  count(*) filter(where editorial_status in ('pending','needs_rewrite','needs_discussion')) as awaiting_review
from public.category_review_queue_v15;

select count(*) as playable_blocked_faostat_elements
from public.stat_categories category
where lower(coalesce(category.source_organization,''))='faostat'
  and coalesce(category.source_indicator_code,'') ~* '^QCL:'
  and regexp_replace(regexp_replace(coalesce(category.source_indicator_code,''), '^.*:', ''),'[^0-9]','','g')
      in ('5312','5320','5412','5417')
  and (category.enabled or category.eligible_daily);

select count(*) as playable_retired_v15_9_1
from public.category_review_queue_v15 queue
join public.v15_9_1_retired_category_ids retired on retired.category_id=queue.id
where queue.computed_playable_v15;

select count(*) as selectively_removed_unscored_boards
from public.v15_9_1_removed_daily_challenges;
