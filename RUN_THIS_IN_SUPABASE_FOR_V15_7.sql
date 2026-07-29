-- GeoStats v15.7.0 clean integrated repository migration
--
-- Prerequisite: the v15.6.2 database migration completed successfully.
-- Safe to rerun. First execution captures exact category/review state for rollback.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v15.7.0-clean-rebuild'));

-- ---------------------------------------------------------------------------
-- 1. Preflight the live schema before making changes.
-- ---------------------------------------------------------------------------
do $$
declare
  missing_columns text;
begin
  if to_regclass('public.category_review_queue_v15') is null then
    raise exception 'v15.7 stopped: category_review_queue_v15 is missing.';
  end if;
  if to_regclass('public.category_catalog_editorial_v15_6') is null then
    raise exception 'v15.7 stopped: category_catalog_editorial_v15_6 is missing.';
  end if;
  if to_regprocedure('public.reconcile_category_playability_v15()') is null then
    raise exception 'v15.7 stopped: reconcile_category_playability_v15() is missing.';
  end if;

  with required_columns(table_name, column_name) as (
    values
      ('stat_categories', 'id'),
      ('stat_categories', 'title'),
      ('stat_categories', 'short_title'),
      ('stat_categories', 'description'),
      ('stat_categories', 'plain_language_description'),
      ('stat_categories', 'technical_definition'),
      ('stat_categories', 'common_year'),
      ('stat_categories', 'common_year_coverage'),
      ('stat_categories', 'player_source_url'),
      ('stat_categories', 'methodology_url'),
      ('stat_categories', 'source_organization'),
      ('stat_categories', 'source_indicator_code'),
      ('stat_categories', 'semantic_family'),
      ('stat_categories', 'concept_group'),
      ('stat_categories', 'family'),
      ('stat_categories', 'unit'),
      ('stat_categories', 'value_type'),
      ('stat_categories', 'metadata'),
      ('stat_categories', 'enabled'),
      ('stat_categories', 'eligible_daily'),
      ('stat_categories', 'validation_status'),
      ('stat_categories', 'validation_reason'),
      ('stat_categories', 'updated_at'),
      ('category_review_state', 'category_id'),
      ('category_review_state', 'status'),
      ('category_review_state', 'poor_coverage'),
      ('category_review_state', 'political_self_reported'),
      ('category_review_state', 'confusing'),
      ('category_review_state', 'esoteric'),
      ('category_review_state', 'subjective_or_composite'),
      ('category_review_state', 'stale_data'),
      ('category_review_state', 'duplicate_of'),
      ('category_review_state', 'recommended_title'),
      ('category_review_state', 'semantic_group'),
      ('category_review_state', 'reviewed_at'),
      ('category_review_state', 'notes'),
      ('category_review_state', 'updated_at'),
      ('daily_challenges', 'challenge_date'),
      ('daily_challenges', 'difficulty'),
      ('daily_challenges', 'seed'),
      ('daily_challenges', 'encoded_board'),
      ('daily_challenges', 'board_hash'),
      ('daily_challenges', 'dataset_version'),
      ('daily_challenges', 'created_at'),
      ('daily_challenges', 'rules_version'),
      ('daily_challenges', 'category_set_version'),
      ('daily_scores', 'challenge_date'),
      ('daily_scores', 'difficulty'),
      ('stat_observations', 'category_id'),
      ('stat_observations', 'country_iso3'),
      ('category_catalog_editorial_v15_6', 'category_id'),
      ('category_catalog_editorial_v15_6', 'player_title'),
      ('category_catalog_editorial_v15_6', 'player_description'),
      ('category_catalog_editorial_v15_6', 'editorial_outcome'),
      ('category_catalog_editorial_v15_6', 'decision_reason'),
      ('category_catalog_editorial_v15_6', 'preferred_category_id'),
      ('category_catalog_editorial_v15_6', 'decision_source'),
      ('category_catalog_editorial_v15_6', 'reviewed_at'),
      ('category_review_queue_v15', 'id'),
      ('category_review_queue_v15', 'computed_playable_v15'),
      ('category_review_queue_v15', 'editorial_status'),
      ('category_review_queue_v15', 'hard_gate_ready'),
      ('category_review_queue_v15', 'effective_title'),
      ('category_review_queue_v15', 'source_organization'),
      ('category_review_queue_v15', 'source_indicator_code')
  )
  select string_agg(required.table_name || '.' || required.column_name, ', ' order by 1)
  into missing_columns
  from required_columns required
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = required.table_name
   and actual.column_name = required.column_name
  where actual.column_name is null;

  if missing_columns is not null then
    raise exception 'v15.7 stopped. Missing required columns: %', missing_columns;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Exact backups for all catalog/review fields this release may change.
-- ---------------------------------------------------------------------------
create table if not exists public.v15_7_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_7_category_backup(category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict (category_id) do nothing;

create table if not exists public.v15_7_review_state_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_7_review_state_backup(category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict (category_id) do nothing;

create table if not exists public.v15_7_editorial_backup (
  category_id text primary key,
  editorial_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_7_editorial_backup(category_id, editorial_state)
select category_id, to_jsonb(editorial)
from public.category_catalog_editorial_v15_6 editorial
on conflict (category_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Immutable board snapshots and one-generator-per-date locking.
-- ---------------------------------------------------------------------------
alter table public.daily_challenges
  add column if not exists board_payload jsonb;

create table if not exists public.daily_generation_locks_v15_7 (
  challenge_date date primary key,
  lock_token uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_generation_locks_v15_7_expiry_idx
  on public.daily_generation_locks_v15_7(expires_at);

alter table public.daily_generation_locks_v15_7 enable row level security;
revoke all on public.daily_generation_locks_v15_7 from public, anon, authenticated;
grant all on public.daily_generation_locks_v15_7 to service_role;

-- ---------------------------------------------------------------------------
-- 4. One authoritative approved catalog and structured generation metadata.
--    Player wording is no longer used to infer measure or strategy behavior.
-- ---------------------------------------------------------------------------
update public.category_catalog_editorial_v15_6
set editorial_outcome = 'daily',
    decision_reason = 'Approved for every game mode under the v15.7 single-catalog policy.',
    decision_source = 'v15.7 clean rebuild',
    reviewed_at = now()
where editorial_outcome = 'random';

update public.stat_categories category
set metadata = (
      coalesce(category.metadata, '{}'::jsonb)
      - 'randomOnly'
    ) || jsonb_build_object(
      'strategyFamily',
        case
          when category.source_organization = 'UN Comtrade'
            then 'product-export:' || category.source_indicator_code
          when category.source_indicator_code in ('EN.GHG.CO2.PC.CE.AR5', 'EN.GHG.ALL.MT.CE.AR5')
            then 'greenhouse-gas-emissions'
          when category.source_indicator_code in (
            'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
            'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
            'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
          ) then 'service-composition'
          else coalesce(
            nullif(category.metadata->>'strategyFamily', ''),
            nullif(category.semantic_family, ''),
            nullif(category.concept_group, ''),
            lower(regexp_replace(category.family, '[^a-z0-9]+', '-', 'gi'))
          )
        end,
      'knowledgeCluster',
        case
          when category.source_organization = 'UN Comtrade' then 'product-exports'
          when category.source_indicator_code in ('EN.GHG.CO2.PC.CE.AR5', 'EN.GHG.ALL.MT.CE.AR5')
            then 'greenhouse-gas-emissions'
          when category.source_indicator_code in (
            'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
            'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
            'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
          ) then 'service-composition'
          else coalesce(
            nullif(category.metadata->>'knowledgeCluster', ''),
            nullif(category.concept_group, ''),
            nullif(category.semantic_family, ''),
            lower(regexp_replace(category.family, '[^a-z0-9]+', '-', 'gi'))
          )
        end,
      'measureType',
        case
          when lower(coalesce(category.value_type, '')) like '%index%'
            or lower(coalesce(category.unit, '')) like '%index%' then 'index'
          when coalesce(category.unit, '') ~* '%|percent|share' then 'share'
          when lower(coalesce(category.value_type, '')) like '%rate%'
            or coalesce(category.unit, '') ~* '\mper\M' then 'rate'
          when lower(coalesce(category.value_type, '')) like '%count%'
            or coalesce(category.unit, '') ~* 'people|persons|number|sites|countries'
            then 'count'
          when coalesce(category.unit, '') ~* 'km|hectare|tonne|metric ton|meter|litre|liter|barrel'
            then 'physical'
          else 'total'
        end,
      'normalizationType',
        case
          when coalesce(category.unit, '') ~* 'per (person|capita)' then 'per-person'
          when coalesce(category.unit, '') ~* 'per (km|square|hectare|area)' then 'per-area'
          when coalesce(category.unit, '') ~* '%|percent|share' then 'percentage'
          when coalesce(category.unit, '') ~* 'per 100|per 1,000|per 100,000|rate' then 'rate'
          else 'absolute'
        end,
      'singleApprovedCatalogV15_7', true
    ),
    updated_at = now();

-- Curated player titles and complete board descriptions for the examples reviewed in this cycle.
create temporary table v15_7_curated_copy (
  source_indicator_code text primary key,
  player_title text not null,
  board_description text not null
) on commit drop;

insert into v15_7_curated_copy(source_indicator_code, player_title, board_description)
values
  ('EN.URB.LCTY', 'Largest city by population', 'Population living in each country''s largest urban area.'),
  ('AG.LND.TOTL.K2', 'Largest land area', 'Total land area within the country''s borders.'),
  ('EN.GHG.ALL.MT.CE.AR5', 'Most greenhouse gas emissions', 'Total emissions excluding land use and forestry.'),
  ('EN.GHG.CO2.PC.CE.AR5', 'Most CO₂ emissions per person', 'Average carbon dioxide emissions for each person.'),
  ('EN.ATM.PM25.MC.M3', 'Highest fine-particle air pollution', 'Average exposure to fine airborne particles.'),
  ('BX.GSR.CMCP.ZS', 'Highest communications and IT export share', 'Communications and IT services as a share of service exports.'),
  ('BM.GSR.CMCP.ZS', 'Highest communications and IT import share', 'Communications and IT services as a share of service imports.'),
  ('BX.GSR.TRAN.ZS', 'Highest transport share of service exports', 'Transport services as a share of service exports.'),
  ('BM.GSR.TRAN.ZS', 'Highest transport share of service imports', 'Transport services as a share of service imports.'),
  ('BX.GSR.TRVL.ZS', 'Highest travel share of service exports', 'Foreign visitor spending as a share of service exports.'),
  ('BM.GSR.TRVL.ZS', 'Highest travel share of service imports', 'Resident spending abroad as a share of service imports.');

-- Preserve exact source/editorial wording before applying player copy.
update public.stat_categories category
set metadata = coalesce(category.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'officialSourceTitleV15_7',
          coalesce(category.metadata->>'officialSourceTitleV15_7', category.title),
        'officialDescriptionV15_7',
          coalesce(category.metadata->>'officialDescriptionV15_7', category.description, category.plain_language_description, ''),
        'boardDescription', copy.board_description,
        'boardDescriptionSource', 'v15.7 curated copy'
      ),
    title = copy.player_title,
    short_title = left(regexp_replace(copy.player_title, '^(Highest|Lowest|Largest|Most|Best)\s+', '', 'i'), 70),
    updated_at = now()
from v15_7_curated_copy copy
where category.source_indicator_code = copy.source_indicator_code;

-- Curated concepts are content-approved in every game mode. Integrity flags
-- such as stale_data and poor_coverage are deliberately preserved, so a broken
-- dataset remains blocked by computed_playable_v15.
update public.category_review_state review
set status = 'approved',
    political_self_reported = false,
    confusing = false,
    esoteric = false,
    subjective_or_composite = false,
    duplicate_of = null,
    recommended_title = copy.player_title,
    notes = concat_ws(E'\n', nullif(review.notes, ''), 'v15.7: retained with clear player-facing copy.'),
    reviewed_at = coalesce(review.reviewed_at, now()),
    updated_at = now()
from public.stat_categories category
join v15_7_curated_copy copy on copy.source_indicator_code = category.source_indicator_code
where review.category_id = category.id;

update public.category_catalog_editorial_v15_6 editorial
set player_title = copy.player_title,
    player_description = copy.board_description,
    editorial_outcome = 'daily',
    preferred_category_id = null,
    decision_reason = 'Retained with v15.7 player-facing copy and approved for every game mode.',
    decision_source = 'v15.7 clean rebuild',
    reviewed_at = now()
from public.stat_categories category
join v15_7_curated_copy copy on copy.source_indicator_code = category.source_indicator_code
where editorial.category_id = category.id;

update public.stat_categories category
set metadata = coalesce(category.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'officialSourceTitleV15_7',
      coalesce(category.metadata->>'officialSourceTitleV15_7', category.title),
    'officialDescriptionV15_7',
      coalesce(category.metadata->>'officialDescriptionV15_7', category.description, category.plain_language_description, ''),
    'boardDescription', 'Total production of primary, unprocessed fruit crops.',
    'boardDescriptionSource', 'v15.7 curated copy'
  ),
  updated_at = now()
where lower(category.source_organization) like '%fao%'
  and category.title ~* 'fruit primary|most fruit produced';

update public.stat_categories category
set title = 'Most fruit produced',
    short_title = 'Fruit produced',
    updated_at = now()
where lower(category.source_organization) like '%fao%'
  and category.title ~* 'fruit primary|most fruit produced';

update public.category_review_state review
set status = 'approved',
    confusing = false,
    esoteric = false,
    subjective_or_composite = false,
    duplicate_of = null,
    recommended_title = 'Most fruit produced',
    reviewed_at = coalesce(review.reviewed_at, now()),
    updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and lower(category.source_organization) like '%fao%'
  and category.title = 'Most fruit produced';

update public.category_catalog_editorial_v15_6 editorial
set player_title = 'Most fruit produced',
    player_description = 'Total production of primary, unprocessed fruit crops.',
    editorial_outcome = 'daily',
    preferred_category_id = null,
    decision_reason = 'Retained with v15.7 player-facing copy and approved for every game mode.',
    decision_source = 'v15.7 clean rebuild',
    reviewed_at = now()
from public.stat_categories category
where editorial.category_id = category.id
  and lower(category.source_organization) like '%fao%'
  and category.title = 'Most fruit produced';

-- Prefer the official land-area series and block the mapped calculation as a duplicate.
with preferred as (
  select id
  from public.stat_categories
  where source_indicator_code = 'AG.LND.TOTL.K2'
  order by id
  limit 1
), duplicates as (
  select id
  from public.stat_categories
  where (source_organization = 'Natural Earth' and source_indicator_code = 'largest-geodesic-land-area')
     or title ~* '^Largest mapped land area$'
)
update public.category_review_state review
set status = 'duplicate',
    duplicate_of = preferred.id,
    notes = concat_ws(E'\n', nullif(review.notes, ''), 'v15.7: duplicate of the preferred official land-area category.'),
    reviewed_at = now(),
    updated_at = now()
from duplicates, preferred
where review.category_id = duplicates.id;

update public.category_catalog_editorial_v15_6 editorial
set editorial_outcome = 'duplicate',
    preferred_category_id = preferred.id,
    decision_reason = 'Duplicate of the preferred official land-area category.',
    decision_source = 'v15.7 clean rebuild',
    reviewed_at = now()
from (
  select id
  from public.stat_categories
  where source_indicator_code = 'AG.LND.TOTL.K2'
  order by id
  limit 1
) preferred,
(
  select id
  from public.stat_categories
  where (source_organization = 'Natural Earth' and source_indicator_code = 'largest-geodesic-land-area')
     or title ~* '^Largest mapped land area$'
) duplicate_category
where editorial.category_id = duplicate_category.id;

-- Reuse an already concise, complete plain-language sentence where available.
update public.stat_categories category
set metadata = coalesce(category.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'boardDescription', trim(category.plain_language_description),
    'boardDescriptionSource', 'existing short plain-language description'
  ),
  updated_at = now()
where category.metadata->>'boardDescription' is null
  and char_length(trim(coalesce(category.plain_language_description, ''))) between 12 and 110
  and trim(category.plain_language_description) ~ '[.!?]$';

-- ---------------------------------------------------------------------------
-- 5. Quarantine physical categories that currently have zero observations.
--    These remain content-approved but are blocked by a real integrity failure.
-- ---------------------------------------------------------------------------
create table if not exists public.v15_7_broken_dataset_decisions (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  title text not null,
  observation_count integer not null,
  reason text not null,
  assessed_at timestamptz not null default now()
);

-- If a later importer repair has populated one of these datasets, a rerun clears
-- only the exact v15.7 zero-row quarantine and restores its prior validation flag.
with repaired as (
  select category.id
  from public.stat_categories category
  join public.v15_7_broken_dataset_decisions decision on decision.category_id = category.id
  join public.stat_observations observation on observation.category_id = category.id
  group by category.id
  having count(observation.country_iso3) > 0
)
update public.category_review_state review
set poor_coverage = coalesce((backup.review_state->>'poor_coverage')::boolean, false),
    updated_at = now()
from repaired
join public.v15_7_review_state_backup backup on backup.category_id = repaired.id
join public.stat_categories category on category.id = repaired.id
where review.category_id = repaired.id
  and category.validation_reason = 'v15.7: zero stored observations; importer/source-key repair required.';

with repaired as (
  select category.id
  from public.stat_categories category
  join public.v15_7_broken_dataset_decisions decision on decision.category_id = category.id
  join public.stat_observations observation on observation.category_id = category.id
  group by category.id
  having count(observation.country_iso3) > 0
)
update public.stat_categories category
set validation_status = backup.category_state->>'validation_status',
    validation_reason = backup.category_state->>'validation_reason',
    metadata = coalesce(category.metadata, '{}'::jsonb) - 'datasetRepairStatusV15_7',
    updated_at = now()
from repaired
join public.v15_7_category_backup backup on backup.category_id = repaired.id
where category.id = repaired.id
  and category.validation_reason = 'v15.7: zero stored observations; importer/source-key repair required.';

delete from public.v15_7_broken_dataset_decisions decision
where exists (
  select 1
  from public.stat_observations observation
  where observation.category_id = decision.category_id
);

insert into public.v15_7_broken_dataset_decisions(category_id, title, observation_count, reason)
select
  category.id,
  category.title,
  count(observation.country_iso3)::integer,
  'No stored observations are available. Repair the physical-summary importer or source-key mapping before promotion.'
from public.stat_categories category
left join public.stat_observations observation on observation.category_id = category.id
where category.title ~* '^(Northernmost country|Southernmost country|Longest combined land borders|North[- ]south span)$'
group by category.id, category.title
having count(observation.country_iso3) = 0
on conflict (category_id) do update set
  title = excluded.title,
  observation_count = excluded.observation_count,
  reason = excluded.reason,
  assessed_at = now();

update public.category_review_state review
set poor_coverage = true,
    notes = concat_ws(
      E'\n',
      nullif(review.notes, ''),
      'v15.7 integrity quarantine: zero stored observations; importer/source-key repair required.'
    ),
    updated_at = now()
where review.category_id in (select category_id from public.v15_7_broken_dataset_decisions);

update public.stat_categories category
set validation_status = 'failed',
    validation_reason = 'v15.7: zero stored observations; importer/source-key repair required.',
    metadata = coalesce(category.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'datasetRepairStatusV15_7', 'quarantined-zero-observations',
        'catalogTier', 'quarantined'
      ),
    enabled = false,
    eligible_daily = false,
    updated_at = now()
where category.id in (select category_id from public.v15_7_broken_dataset_decisions);

-- Recompute runtime playability from the authoritative review/integrity view.
select * from public.reconcile_category_playability_v15();

-- The metadata tier is now display-only and mirrors the authoritative computed result.
update public.stat_categories category
set metadata = (
      coalesce(category.metadata, '{}'::jsonb)
      - 'randomOnly'
    ) || jsonb_build_object(
      'catalogTier', case when queue.computed_playable_v15 then 'daily' else 'quarantined' end,
      'singleApprovedCatalogV15_7', true
    ),
    enabled = queue.computed_playable_v15,
    eligible_daily = queue.computed_playable_v15,
    updated_at = now()
from public.category_review_queue_v15 queue
where queue.id = category.id;

-- ---------------------------------------------------------------------------
-- 6. A complete manual-copy review view for all approved categories.
-- ---------------------------------------------------------------------------
create or replace view public.category_manual_review_v15_7
with (security_invoker=true)
as
select
  queue.id as category_id,
  queue.source_organization,
  queue.source_indicator_code,
  queue.editorial_status,
  queue.computed_playable_v15 as playable,
  queue.effective_title as player_title,
  nullif(category.metadata->>'boardDescription', '') as board_description,
  category.plain_language_description,
  category.technical_definition,
  category.unit,
  category.common_year,
  category.common_year_coverage,
  category.player_source_url,
  category.methodology_url,
  coalesce(category.metadata->>'officialSourceTitleV15_7', category.metadata->>'officialSourceTitleV15_6_2') as preserved_source_title,
  coalesce(category.metadata->>'officialDescriptionV15_7', category.metadata->>'officialDescriptionV15_6_2') as preserved_source_description,
  array_remove(array[
    case when char_length(queue.effective_title) > 58 then 'Title exceeds 58 characters.' end,
    case when cardinality(regexp_split_to_array(trim(queue.effective_title), '\s+')) > 9 then 'Title exceeds 9 words.' end,
    case when queue.effective_title ~* '\betc\.|\bn\.e\.c\.' then 'Title contains source jargon.' end,
    case when queue.effective_title ~ '\m[A-Z][A-Z0-9]{2,}\M' then 'Title contains an acronym.' end,
    case when nullif(category.metadata->>'boardDescription', '') is null then 'Board description needs manual review.' end,
    case when char_length(coalesce(category.metadata->>'boardDescription', '')) > 110 then 'Board description exceeds 110 characters.' end,
    case when coalesce(category.metadata->>'boardDescription', '') ~ '(…|\.\.\.)\s*$' then 'Board description appears truncated.' end
  ], null) as copy_flags
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id = queue.id
where queue.editorial_status = 'approved';

revoke all on public.category_manual_review_v15_7 from public, anon, authenticated;
grant select on public.category_manual_review_v15_7 to service_role;

-- ---------------------------------------------------------------------------
-- 7. Safely invalidate only unscored current/future boards from older rules or
--    category sets. Historical boards and every scored mode remain intact.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_archive_v15_7
  (like public.daily_challenges including all);

create table if not exists public.v15_7_removed_daily_challenges (
  challenge_date date not null,
  difficulty text not null,
  removed_at timestamptz not null default now(),
  primary key (challenge_date, difficulty)
);

insert into public.daily_challenge_archive_v15_7
select challenge.*
from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version, '') <> '13.0'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-7-CLEAN'
  )
on conflict (challenge_date, difficulty) do update set
  seed = excluded.seed,
  encoded_board = excluded.encoded_board,
  board_payload = excluded.board_payload,
  board_hash = excluded.board_hash,
  dataset_version = excluded.dataset_version,
  rules_version = excluded.rules_version,
  category_set_version = excluded.category_set_version,
  created_at = excluded.created_at;

insert into public.v15_7_removed_daily_challenges(challenge_date, difficulty)
select challenge.challenge_date, challenge.difficulty
from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version, '') <> '13.0'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-7-CLEAN'
  )
  and not exists (
    select 1
    from public.daily_scores score
    where score.challenge_date = challenge.challenge_date
      and score.difficulty = challenge.difficulty
  )
on conflict (challenge_date, difficulty) do nothing;

delete from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version, '') <> '13.0'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-7-CLEAN'
  )
  and not exists (
    select 1
    from public.daily_scores score
    where score.challenge_date = challenge.challenge_date
      and score.difficulty = challenge.difficulty
  );

commit;

-- Installation summary.
select
  count(*) filter (where computed_playable_v15) as playable,
  count(*) filter (where editorial_status = 'approved') as approved,
  count(*) filter (where editorial_status = 'approved' and not computed_playable_v15) as approved_but_blocked,
  count(*) filter (where hard_gate_ready) as integrity_ready
from public.category_review_queue_v15;

select count(*) as random_tier_metadata
from public.stat_categories
where metadata->>'catalogTier' = 'random';

select *
from public.v15_7_broken_dataset_decisions
order by title;
