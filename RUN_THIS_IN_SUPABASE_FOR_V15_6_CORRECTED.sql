-- GeoStats v15.6 corrected Supabase installer
-- Corrects the nonexistent stat_categories.indicator_code references.
-- Adds schema preflight checks and exact backups.
-- Archives all incompatible boards, but removes only current/future incompatible
-- boards from active tables. Historical active boards and scores are preserved.
--
-- This corrects the database installer only. It does not by itself make the
-- v15.6 catalog review comprehensive or add the planned source importers.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v15.6-corrected-installer'));

-- ---------------------------------------------------------------------------
-- 1. Fail before changing anything if the live schema is not compatible.
-- ---------------------------------------------------------------------------
do $$
declare
  missing_columns text;
begin
  with required_columns(table_name, column_name) as (
    values
      ('stat_categories', 'id'),
      ('stat_categories', 'title'),
      ('stat_categories', 'short_title'),
      ('stat_categories', 'description'),
      ('stat_categories', 'plain_language_description'),
      ('stat_categories', 'enabled'),
      ('stat_categories', 'eligible_daily'),
      ('stat_categories', 'metadata'),
      ('stat_categories', 'family'),
      ('stat_categories', 'semantic_family'),
      ('stat_categories', 'concept_group'),
      ('stat_categories', 'source_organization'),
      ('stat_categories', 'source_indicator_code'),
      ('stat_categories', 'content_review_status'),
      ('stat_categories', 'player_quality_status'),
      ('stat_categories', 'updated_at'),
      ('data_sources', 'id'),
      ('data_sources', 'name'),
      ('data_sources', 'status'),
      ('data_sources', 'description'),
      ('data_sources', 'display_order'),
      ('data_sources', 'metadata'),
      ('data_sources', 'created_at'),
      ('data_sources', 'updated_at'),
      ('daily_challenges', 'challenge_date'),
      ('daily_challenges', 'difficulty'),
      ('daily_challenges', 'seed'),
      ('daily_challenges', 'encoded_board'),
      ('daily_challenges', 'board_hash'),
      ('daily_challenges', 'dataset_version'),
      ('daily_challenges', 'rules_version'),
      ('daily_challenges', 'category_set_version'),
      ('daily_challenges', 'created_at'),
      ('daily_scores', 'id'),
      ('daily_scores', 'challenge_date'),
      ('daily_scores', 'difficulty')
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
    raise exception 'v15.6 installer stopped. Missing required columns: %', missing_columns;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Preserve the exact category fields this installer may modify.
-- ---------------------------------------------------------------------------
create table if not exists public.v15_6_category_backup (
  category_id text primary key,
  title text not null,
  short_title text,
  description text not null,
  plain_language_description text,
  enabled boolean not null,
  eligible_daily boolean not null,
  content_review_status text not null,
  player_quality_status text,
  metadata jsonb not null,
  updated_at timestamptz not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_6_category_backup (
  category_id, title, short_title, description, plain_language_description,
  enabled, eligible_daily, content_review_status, player_quality_status,
  metadata, updated_at
)
select
  id, title, short_title, description, plain_language_description,
  enabled, eligible_daily, content_review_status, player_quality_status,
  metadata, updated_at
from public.stat_categories
on conflict (category_id) do nothing;

-- Preserve the pre-v15.6 state of the four source-registration rows.
create table if not exists public.v15_6_source_backup (
  source_id text primary key,
  existed_before boolean not null,
  source_state jsonb,
  captured_at timestamptz not null default now()
);

insert into public.v15_6_source_backup(source_id, existed_before, source_state)
select
  requested.source_id,
  source.id is not null,
  case when source.id is null then null else to_jsonb(source) end
from (
  values
    ('unescoheritage'::text),
    ('aquastat'::text),
    ('usgsminerals'::text),
    ('faofisheries'::text)
) requested(source_id)
left join public.data_sources source on source.id = requested.source_id
on conflict (source_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Editorial-decision layer.
-- ---------------------------------------------------------------------------
create table if not exists public.category_catalog_editorial_v15_6 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  original_title text not null,
  player_title text not null,
  player_description text,
  editorial_outcome text not null
    check (editorial_outcome in (
      'daily', 'random', 'rewrite', 'duplicate', 'retired', 'quarantined'
    )),
  decision_reason text not null,
  preferred_category_id text,
  broad_domain text not null default 'other',
  knowledge_cluster text not null default 'other',
  strategy_family text not null default 'other',
  decision_source text not null default 'v15.6 catalog reset',
  reviewed_at timestamptz not null default now()
);

insert into public.category_catalog_editorial_v15_6 (
  category_id, original_title, player_title, player_description,
  editorial_outcome, decision_reason, broad_domain,
  knowledge_cluster, strategy_family
)
select
  category.id,
  category.title,
  category.title,
  coalesce(category.plain_language_description, category.description),
  case
    when category.enabled and category.eligible_daily then 'daily'
    when category.enabled then 'random'
    else 'quarantined'
  end,
  'Awaiting v15.6 full editorial decision.',
  coalesce(category.metadata->>'broadDomain', lower(category.family), 'other'),
  coalesce(
    category.metadata->>'knowledgeCluster',
    category.semantic_family,
    category.concept_group,
    lower(category.family),
    'other'
  ),
  coalesce(
    category.metadata->>'strategyFamily',
    category.semantic_family,
    category.concept_group,
    lower(category.family),
    'other'
  )
from public.stat_categories category
on conflict (category_id) do nothing;

-- Retire FAOSTAT non-production measures. The live schema uses only
-- source_indicator_code; indicator_code does not exist.
update public.category_catalog_editorial_v15_6 editorial
set
  editorial_outcome = 'retired',
  decision_reason =
    'Retired by v15.6 production-only agriculture policy: yield, harvested area, stocks, producing animals, slaughter counts, carcass weight and efficiency measures are excluded.',
  reviewed_at = now()
from public.stat_categories category
where category.id = editorial.category_id
  and lower(coalesce(category.source_organization, '')) like '%fao%'
  and coalesce(category.source_indicator_code, '')
      ~* 'QCL:''?[^:]+:(5312|5412|5417|5111|5320|5513[0-9])';

-- Retire named contrived concepts.
update public.category_catalog_editorial_v15_6 editorial
set
  editorial_outcome = 'retired',
  decision_reason =
    'Retired by v15.6 immediate-understanding review: the concept is contrived or cannot be simplified accurately.',
  reviewed_at = now()
from public.stat_categories category
where category.id = editorial.category_id
  and (
    coalesce(category.source_indicator_code, '') in (
      'FI.RES.TOTL.CD',
      'SP.URB.TOTL',
      'SP.RUR.TOTL'
    )
    or category.title ~* (
      'total reserves.*(minus|excluding) gold'
      '|largest continuous land area'
      '|largest mapped land area'
      '|net errors and omissions'
      '|urban agglomerations of more than 1 million'
    )
  );

-- Curated player-facing rewrites.
-- A rewrite does not promote a random-only or quarantined category to Daily.
with rewrites(
  source_indicator_code,
  old_pattern,
  player_title,
  player_description
) as (
  values
    (
      'CM.MKT.TRAD.CD'::text,
      'stocks traded'::text,
      'Most stock trading'::text,
      'Total value of shares traded during the year.'::text
    ),
    (
      'SH.H2O.SMDW.ZS',
      'safely managed drinking',
      'Best access to safe drinking water',
      'Share of people using safely managed drinking-water services.'
    ),
    (
      'ER.LND.PTLD.ZS',
      'protected-land',
      'Most land protected',
      'Share of national land area officially protected.'
    ),
    (
      null,
      'STEM graduate',
      'Most graduates in STEM',
      'Share of tertiary graduates completing science, technology, engineering or mathematics programs.'
    ),
    (
      null,
      'mapped river density',
      'Highest river density',
      'Total river length relative to land area.'
    )
)
update public.category_catalog_editorial_v15_6 editorial
set
  player_title = rewrite.player_title,
  player_description = rewrite.player_description,
  editorial_outcome = case
    when editorial.editorial_outcome in ('retired', 'duplicate', 'quarantined', 'random')
      then editorial.editorial_outcome
    else 'rewrite'
  end,
  decision_reason = 'Retained with a deliberate v15.6 player-facing rewrite.',
  reviewed_at = now()
from public.stat_categories category,
     rewrites rewrite
where category.id = editorial.category_id
  and (
    (
      rewrite.source_indicator_code is not null
      and coalesce(category.source_indicator_code, '') = rewrite.source_indicator_code
    )
    or category.title ilike '%' || rewrite.old_pattern || '%'
  );

-- Keep the preferred origin-based displacement representative and block
-- the two near-duplicate origin concepts.
update public.category_catalog_editorial_v15_6 editorial
set
  editorial_outcome = 'duplicate',
  preferred_category_id = (
    select category.id
    from public.stat_categories category
    where coalesce(category.source_indicator_code, '') = 'population:coo:refugees'
    order by category.id
    limit 1
  ),
  decision_reason =
    'Duplicate origin-based displacement concept; Most refugees living abroad is the preferred representative.',
  reviewed_at = now()
from public.stat_categories category
where category.id = editorial.category_id
  and coalesce(category.source_indicator_code, '') in (
    'asylum-applications:coo:applied',
    'population:coo:asylum_seekers'
  );

-- Apply decisions to the current runtime fields.
update public.stat_categories category
set
  title = editorial.player_title,
  short_title = left(
    regexp_replace(
      editorial.player_title,
      '^(Highest|Lowest|Largest|Most)\s+',
      '',
      'i'
    ),
    70
  ),
  description = coalesce(editorial.player_description, category.description),
  plain_language_description = coalesce(
    editorial.player_description,
    category.plain_language_description,
    category.description
  ),
  enabled = editorial.editorial_outcome in ('daily', 'random', 'rewrite'),
  eligible_daily = editorial.editorial_outcome in ('daily', 'rewrite'),
  content_review_status = case
    when editorial.editorial_outcome in ('retired', 'duplicate') then 'excluded'
    when editorial.editorial_outcome = 'quarantined' then 'pending'
    else 'approved'
  end,
  player_quality_status = case
    when editorial.editorial_outcome in ('retired', 'duplicate') then 'blocked'
    when editorial.editorial_outcome = 'quarantined' then 'caution'
    else 'approved'
  end,
  metadata = coalesce(category.metadata, '{}'::jsonb) || jsonb_build_object(
    'editorialOutcomeV15_6', editorial.editorial_outcome,
    'catalogDecisionReasonV15_6', editorial.decision_reason,
    'preferredCategoryId', editorial.preferred_category_id,
    'broadDomain', editorial.broad_domain,
    'knowledgeCluster', editorial.knowledge_cluster,
    'strategyFamily', editorial.strategy_family,
    'officialSourceTitleV15_6', editorial.original_title
  ),
  updated_at = now()
from public.category_catalog_editorial_v15_6 editorial
where category.id = editorial.category_id;

-- ---------------------------------------------------------------------------
-- 4. Truthful source registrations: planned only, not playable.
-- ---------------------------------------------------------------------------
insert into public.data_sources (
  id, name, status, description, display_order, metadata, created_at, updated_at
)
values
  (
    'unescoheritage',
    'UNESCO World Heritage Centre',
    'planned',
    'Country counts of inscribed World Heritage properties.',
    38,
    '{"v15_6":"intake-ready"}'::jsonb,
    now(),
    now()
  ),
  (
    'aquastat',
    'FAO AQUASTAT',
    'planned',
    'Country water resources and water-stress indicators.',
    39,
    '{"v15_6":"intake-ready"}'::jsonb,
    now(),
    now()
  ),
  (
    'usgsminerals',
    'USGS Minerals',
    'planned',
    'Curated total mine-production categories for familiar minerals only.',
    40,
    '{"v15_6":"intake-ready"}'::jsonb,
    now(),
    now()
  ),
  (
    'faofisheries',
    'FAO Fisheries',
    'planned',
    'Curated total capture and aquaculture production categories.',
    41,
    '{"v15_6":"intake-ready"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  description = excluded.description,
  metadata = coalesce(public.data_sources.metadata, '{}'::jsonb)
             || excluded.metadata,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- 5. Archive all incompatible boards, but remove only current/future ones.
-- Historical boards cannot block today's date and are preserved in place.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_archive_v15_6
  (like public.daily_challenges including all);

create table if not exists public.daily_score_archive_v15_6
  (like public.daily_scores including all);

create table if not exists public.v15_6_removed_daily_challenges (
  challenge_date date not null,
  difficulty text not null,
  removed_at timestamptz not null default now(),
  primary key (challenge_date, difficulty)
);

create table if not exists public.v15_6_removed_daily_scores (
  score_id bigint primary key,
  removed_at timestamptz not null default now()
);

insert into public.daily_challenge_archive_v15_6
select challenge.*
from public.daily_challenges challenge
where coalesce(challenge.rules_version, '') <> '12.2'
on conflict (challenge_date, difficulty) do update
set
  seed = excluded.seed,
  encoded_board = excluded.encoded_board,
  board_hash = excluded.board_hash,
  dataset_version = excluded.dataset_version,
  rules_version = excluded.rules_version,
  category_set_version = excluded.category_set_version,
  created_at = excluded.created_at;

insert into public.daily_score_archive_v15_6
select score.*
from public.daily_scores score
join public.daily_challenges challenge
  using (challenge_date, difficulty)
where coalesce(challenge.rules_version, '') <> '12.2'
on conflict (id) do nothing;

insert into public.v15_6_removed_daily_challenges(challenge_date, difficulty)
select challenge.challenge_date, challenge.difficulty
from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2'
on conflict (challenge_date, difficulty) do nothing;

insert into public.v15_6_removed_daily_scores(score_id)
select score.id
from public.daily_scores score
join public.daily_challenges challenge
  using (challenge_date, difficulty)
where challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2'
on conflict (score_id) do nothing;

delete from public.daily_scores score
using public.daily_challenges challenge
where score.challenge_date = challenge.challenge_date
  and score.difficulty = challenge.difficulty
  and challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2';

delete from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2';

commit;

-- Installation summary.
select
  editorial_outcome,
  count(*) as category_count
from public.category_catalog_editorial_v15_6
group by editorial_outcome
order by editorial_outcome;

select
  (select count(*) from public.v15_6_category_backup) as backed_up_categories,
  (select count(*) from public.daily_challenge_archive_v15_6) as archived_challenges,
  (select count(*) from public.daily_score_archive_v15_6) as archived_scores,
  (select count(*) from public.v15_6_removed_daily_challenges) as removed_current_or_future_challenges,
  (select count(*) from public.v15_6_removed_daily_scores) as removed_current_or_future_scores;
