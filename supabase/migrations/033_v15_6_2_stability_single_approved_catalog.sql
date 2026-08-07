-- GeoStats v15.6.2 stability and single-approved-catalog migration
--
-- Prerequisites:
--   1. RUN_THIS_IN_SUPABASE_FOR_V15_6_CORRECTED.sql
--   2. RUN_THIS_IN_SUPABASE_FOR_V15_6_1.sql
--
-- Safe to rerun. First execution captures exact pre-v15.6.2 state.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v15.6.2-stability'));

do $$
declare
  missing_columns text;
begin
  if to_regclass('public.category_catalog_editorial_v15_6') is null then
    raise exception 'v15.6.2 stopped: category_catalog_editorial_v15_6 is missing.';
  end if;
  if to_regclass('public.category_review_state') is null then
    raise exception 'v15.6.2 stopped: category_review_state is missing.';
  end if;

  with required_columns(table_name, column_name) as (
    values
      ('stat_categories', 'id'),
      ('stat_categories', 'title'),
      ('stat_categories', 'short_title'),
      ('stat_categories', 'description'),
      ('stat_categories', 'plain_language_description'),
      ('stat_categories', 'source_indicator_code'),
      ('stat_categories', 'semantic_family'),
      ('stat_categories', 'concept_group'),
      ('stat_categories', 'enabled'),
      ('stat_categories', 'eligible_daily'),
      ('stat_categories', 'content_review_status'),
      ('stat_categories', 'player_quality_status'),
      ('stat_categories', 'metadata'),
      ('stat_categories', 'updated_at'),
      ('category_review_state', 'category_id'),
      ('category_review_state', 'status'),
      ('category_review_state', 'political_self_reported'),
      ('category_review_state', 'confusing'),
      ('category_review_state', 'esoteric'),
      ('category_review_state', 'subjective_or_composite'),
      ('category_review_state', 'stale_data'),
      ('category_review_state', 'poor_coverage'),
      ('category_review_state', 'duplicate_of'),
      ('category_review_state', 'recommended_title'),
      ('category_review_state', 'semantic_group'),
      ('category_review_state', 'notes'),
      ('category_review_state', 'updated_at'),
      ('daily_challenges', 'challenge_date'),
      ('daily_challenges', 'difficulty'),
      ('daily_challenges', 'rules_version'),
      ('daily_challenges', 'category_set_version')
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
    raise exception 'v15.6.2 stopped. Missing required columns: %', missing_columns;
  end if;
end
$$;

create table if not exists public.v15_6_2_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_6_2_category_backup(category_id, category_state)
select id, to_jsonb(category)
from public.stat_categories category
on conflict (category_id) do nothing;

create table if not exists public.v15_6_2_review_state_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_6_2_review_state_backup(category_id, review_state)
select category_id, to_jsonb(review)
from public.category_review_state review
on conflict (category_id) do nothing;

create table if not exists public.v15_6_2_editorial_backup (
  category_id text primary key,
  editorial_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_6_2_editorial_backup(category_id, editorial_state)
select category_id, to_jsonb(editorial)
from public.category_catalog_editorial_v15_6 editorial
on conflict (category_id) do nothing;

create table if not exists public.v15_6_2_decisions (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  action text not null check (action in ('approve', 'rewrite', 'quarantine', 'duplicate', 'retire')),
  prior_title text not null,
  player_title text,
  player_description text,
  reason text not null,
  applied_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1. One approved catalog for Daily, Random, and Seeded.
-- ---------------------------------------------------------------------------
insert into public.v15_6_2_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'approve',
  category.title,
  editorial.player_title,
  editorial.player_description,
  'v15.6.2 removes Random-only as a quality tier. Every previously Random-only category is eligible for every game mode, subject to the same hard integrity gate.'
from public.category_catalog_editorial_v15_6 editorial
join public.stat_categories category on category.id = editorial.category_id
where editorial.editorial_outcome = 'random'
   or category.metadata->>'catalogTier' = 'random'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

update public.category_catalog_editorial_v15_6
set editorial_outcome = 'daily',
    decision_reason = 'Approved for all game modes under the v15.6.2 single-catalog policy.',
    decision_source = 'v15.6.2 single approved catalog',
    reviewed_at = now()
where editorial_outcome = 'random';

update public.stat_categories category
set
  metadata = coalesce(category.metadata, '{}'::jsonb)
    - 'randomOnly'
    || jsonb_build_object(
      'catalogTier', 'daily',
      'singleApprovedCatalogV15_6_2', true
    ),
  eligible_daily = true,
  updated_at = now()
where category.id in (
  select category_id
  from public.v15_6_2_decisions
  where action = 'approve'
);

update public.category_review_state review
set
  status = 'approved',
  political_self_reported = false,
  confusing = false,
  esoteric = false,
  subjective_or_composite = false,
  stale_data = false,
  poor_coverage = false,
  duplicate_of = null,
  notes = concat_ws(
    E'\n',
    nullif(review.notes, ''),
    'v15.6.2: prior Random-only classification promoted to the single approved catalog. Runtime integrity checks still apply.'
  ),
  reviewed_at = coalesce(review.reviewed_at, now()),
  updated_at = now()
where review.category_id in (
  select category_id
  from public.v15_6_2_decisions
  where action = 'approve'
);

-- ---------------------------------------------------------------------------
-- 2. Restore CO2 per person as a distinct approved concept.
-- ---------------------------------------------------------------------------
insert into public.v15_6_2_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'rewrite',
  category.title,
  'Most CO₂ emissions per person',
  'Average carbon dioxide emissions for each person.',
  'A clear per-person measure that is distinct from total greenhouse-gas emissions. Similar emissions measures are separated by generation rules.'
from public.stat_categories category
where category.source_indicator_code = 'EN.GHG.CO2.PC.CE.AR5'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- ---------------------------------------------------------------------------
-- 3. Rewrite service-composition indicators by their exact World Bank codes.
-- ---------------------------------------------------------------------------
with rewrites(source_indicator_code, player_title, player_description) as (
  values
    (
      'BX.GSR.CMCP.ZS'::text,
      'Highest communications and IT export share'::text,
      'Communications, computer and information services as a share of service exports.'::text
    ),
    (
      'BM.GSR.CMCP.ZS',
      'Highest communications and IT import share',
      'Communications, computer and information services as a share of service imports.'
    ),
    (
      'BX.GSR.TRAN.ZS',
      'Highest transport share of service exports',
      'Transport services as a share of service exports.'
    ),
    (
      'BM.GSR.TRAN.ZS',
      'Highest transport share of service imports',
      'Transport services as a share of service imports.'
    ),
    (
      'BX.GSR.TRVL.ZS',
      'Highest travel share of service exports',
      'Spending by foreign visitors as a share of service exports.'
    ),
    (
      'BM.GSR.TRVL.ZS',
      'Highest travel share of service imports',
      'Residents’ spending abroad as a share of service imports.'
    )
)
insert into public.v15_6_2_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'rewrite',
  category.title,
  rewrite.player_title,
  rewrite.player_description,
  'Exact indicator-specific rewrite replaces ambiguous source wording and removes “etc.” from player copy.'
from public.stat_categories category
join rewrites rewrite using (source_indicator_code)
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- Preserve source wording for every category touched by this release.
update public.stat_categories category
set metadata = coalesce(category.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'officialSourceTitleV15_6_2',
      coalesce(category.metadata->>'officialSourceTitleV15_6_2', decision.prior_title),
    'officialDescriptionV15_6_2',
      coalesce(
        category.metadata->>'officialDescriptionV15_6_2',
        category.description,
        category.plain_language_description,
        ''
      ),
    'catalogDecisionV15_6_2', decision.action,
    'catalogDecisionReasonV15_6_2', decision.reason
  ),
  updated_at = now()
from public.v15_6_2_decisions decision
where category.id = decision.category_id;

-- Apply curated copy and put all of it in the approved catalog.
update public.stat_categories category
set
  title = decision.player_title,
  short_title = left(
    regexp_replace(decision.player_title, '^(Highest|Lowest|Largest|Most|Best)\s+', '', 'i'),
    70
  ),
  description = decision.player_description,
  plain_language_description = decision.player_description,
  semantic_family = case
    when category.source_indicator_code in (
      'EN.GHG.CO2.PC.CE.AR5',
      'EN.GHG.ALL.MT.CE.AR5'
    ) then 'greenhouse-gas-emissions'
    when category.source_indicator_code in (
      'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
      'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
      'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
    ) then 'service-composition'
    else category.semantic_family
  end,
  concept_group = case
    when category.source_indicator_code in (
      'EN.GHG.CO2.PC.CE.AR5',
      'EN.GHG.ALL.MT.CE.AR5'
    ) then 'greenhouse-gas-emissions'
    when category.source_indicator_code in (
      'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
      'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
      'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
    ) then 'service-composition'
    else category.concept_group
  end,
  enabled = true,
  eligible_daily = true,
  content_review_status = 'approved',
  player_quality_status = 'approved',
  metadata = coalesce(category.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'catalogTier', 'daily',
      'singleApprovedCatalogV15_6_2', true,
      'knowledgeCluster',
        case
          when category.source_indicator_code in (
            'EN.GHG.CO2.PC.CE.AR5',
            'EN.GHG.ALL.MT.CE.AR5'
          ) then 'greenhouse-gas-emissions'
          when category.source_indicator_code in (
            'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
            'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
            'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
          ) then 'service-composition'
          else coalesce(category.metadata->>'knowledgeCluster', category.concept_group, category.family)
        end,
      'strategyFamily',
        case
          when category.source_indicator_code in (
            'EN.GHG.CO2.PC.CE.AR5',
            'EN.GHG.ALL.MT.CE.AR5'
          ) then 'greenhouse-gas-emissions'
          when category.source_indicator_code in (
            'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
            'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
            'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
          ) then 'service-composition'
          else coalesce(category.metadata->>'strategyFamily', category.concept_group, category.family)
        end
    ),
  updated_at = now()
from public.v15_6_2_decisions decision
where category.id = decision.category_id
  and decision.action in ('approve', 'rewrite')
  and decision.player_title is not null
  and decision.player_description is not null;

update public.category_review_state review
set
  status = 'approved',
  political_self_reported = false,
  confusing = false,
  esoteric = false,
  subjective_or_composite = false,
  stale_data = false,
  poor_coverage = false,
  duplicate_of = null,
  recommended_title = decision.player_title,
  semantic_group = case
    when category.source_indicator_code in (
      'EN.GHG.CO2.PC.CE.AR5',
      'EN.GHG.ALL.MT.CE.AR5'
    ) then 'greenhouse-gas-emissions'
    when category.source_indicator_code in (
      'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
      'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
      'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
    ) then 'service-composition'
    else review.semantic_group
  end,
  notes = concat_ws(E'\n', nullif(review.notes, ''), decision.reason),
  reviewed_at = coalesce(review.reviewed_at, now()),
  updated_at = now()
from public.v15_6_2_decisions decision
join public.stat_categories category on category.id = decision.category_id
where review.category_id = decision.category_id
  and decision.action in ('approve', 'rewrite');

update public.category_catalog_editorial_v15_6 editorial
set
  player_title = coalesce(decision.player_title, editorial.player_title),
  player_description = coalesce(decision.player_description, editorial.player_description),
  editorial_outcome = case
    when decision.action in ('approve', 'rewrite') then 'daily'
    when decision.action = 'quarantine' then 'quarantined'
    when decision.action = 'duplicate' then 'duplicate'
    else 'retired'
  end,
  knowledge_cluster = case
    when category.source_indicator_code in (
      'EN.GHG.CO2.PC.CE.AR5',
      'EN.GHG.ALL.MT.CE.AR5'
    ) then 'greenhouse-gas-emissions'
    when category.source_indicator_code in (
      'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
      'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
      'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
    ) then 'service-composition'
    else editorial.knowledge_cluster
  end,
  strategy_family = case
    when category.source_indicator_code in (
      'EN.GHG.CO2.PC.CE.AR5',
      'EN.GHG.ALL.MT.CE.AR5'
    ) then 'greenhouse-gas-emissions'
    when category.source_indicator_code in (
      'BX.GSR.CMCP.ZS', 'BM.GSR.CMCP.ZS',
      'BX.GSR.TRAN.ZS', 'BM.GSR.TRAN.ZS',
      'BX.GSR.TRVL.ZS', 'BM.GSR.TRVL.ZS'
    ) then 'service-composition'
    else editorial.strategy_family
  end,
  decision_reason = decision.reason,
  decision_source = 'v15.6.2 stability and copy patch',
  reviewed_at = now()
from public.v15_6_2_decisions decision
join public.stat_categories category on category.id = decision.category_id
where editorial.category_id = decision.category_id;

-- Recalculate the authoritative runtime flags after review-state changes.
select * from public.reconcile_category_playability_v15();

-- ---------------------------------------------------------------------------
-- 4. Catalog-wide copy audit for the user's later manual review.
-- ---------------------------------------------------------------------------
create table if not exists public.category_copy_audit_v15_6_2 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  title text not null,
  plain_language_description text,
  title_characters integer not null,
  title_words integer not null,
  description_characters integer not null,
  contains_etc boolean not null,
  contains_nec boolean not null,
  contains_acronym boolean not null,
  title_too_long boolean not null,
  description_too_long boolean not null,
  description_appears_cut_off boolean not null,
  needs_manual_copy_review boolean not null,
  audit_reason text not null,
  audited_at timestamptz not null default now()
);

insert into public.category_copy_audit_v15_6_2(
  category_id,
  title,
  plain_language_description,
  title_characters,
  title_words,
  description_characters,
  contains_etc,
  contains_nec,
  contains_acronym,
  title_too_long,
  description_too_long,
  description_appears_cut_off,
  needs_manual_copy_review,
  audit_reason,
  audited_at
)
select
  category.id,
  category.title,
  category.plain_language_description,
  char_length(category.title),
  cardinality(regexp_split_to_array(trim(category.title), '\s+')),
  char_length(coalesce(category.plain_language_description, category.description, '')),
  category.title ~* '\betc\.',
  category.title ~* '\bn\.e\.c\.',
  category.title ~ '\m[A-Z][A-Z0-9]{2,}\M',
  char_length(category.title) > 58
    or cardinality(regexp_split_to_array(trim(category.title), '\s+')) > 9,
  char_length(coalesce(category.plain_language_description, category.description, '')) > 165,
  coalesce(category.plain_language_description, category.description, '') ~ '(…|\.\.\.)\s*$',
  (
    category.title ~* '\betc\.|\bn\.e\.c\.'
    or category.title ~ '\m[A-Z][A-Z0-9]{2,}\M'
    or char_length(category.title) > 58
    or cardinality(regexp_split_to_array(trim(category.title), '\s+')) > 9
    or char_length(coalesce(category.plain_language_description, category.description, '')) > 165
    or coalesce(category.plain_language_description, category.description, '') ~ '(…|\.\.\.)\s*$'
  ),
  concat_ws(
    '; ',
    case when category.title ~* '\betc\.' then 'title contains “etc.”' end,
    case when category.title ~* '\bn\.e\.c\.' then 'title contains source classification “n.e.c.”' end,
    case when category.title ~ '\m[A-Z][A-Z0-9]{2,}\M' then 'title contains an unexplained acronym' end,
    case when char_length(category.title) > 58 then 'title exceeds 58 characters' end,
    case when cardinality(regexp_split_to_array(trim(category.title), '\s+')) > 9 then 'title exceeds 9 words' end,
    case when char_length(coalesce(category.plain_language_description, category.description, '')) > 165 then 'player description exceeds 165 characters' end,
    case when coalesce(category.plain_language_description, category.description, '') ~ '(…|\.\.\.)\s*$' then 'description appears pre-truncated' end
  ),
  now()
from public.stat_categories category
where category.enabled
   or category.eligible_daily
   or category.content_review_status = 'approved'
on conflict (category_id) do update set
  title = excluded.title,
  plain_language_description = excluded.plain_language_description,
  title_characters = excluded.title_characters,
  title_words = excluded.title_words,
  description_characters = excluded.description_characters,
  contains_etc = excluded.contains_etc,
  contains_nec = excluded.contains_nec,
  contains_acronym = excluded.contains_acronym,
  title_too_long = excluded.title_too_long,
  description_too_long = excluded.description_too_long,
  description_appears_cut_off = excluded.description_appears_cut_off,
  needs_manual_copy_review = excluded.needs_manual_copy_review,
  audit_reason = excluded.audit_reason,
  audited_at = now();

update public.stat_categories category
set metadata = coalesce(category.metadata, '{}'::jsonb)
  || jsonb_build_object(
    'copyAuditV15_6_2',
    case when audit.needs_manual_copy_review then 'manual-review' else 'pass' end,
    'copyAuditReasonV15_6_2',
    audit.audit_reason
  ),
  updated_at = now()
from public.category_copy_audit_v15_6_2 audit
where category.id = audit.category_id;

-- ---------------------------------------------------------------------------
-- 5. Archive and remove only unscored current/future boards from older rules
--    or category sets, so v15.6.2 can regenerate them.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_archive_v15_6
  (like public.daily_challenges including all);

create table if not exists public.v15_6_2_removed_daily_challenges (
  challenge_date date not null,
  difficulty text not null,
  removed_at timestamptz not null default now(),
  primary key (challenge_date, difficulty)
);

insert into public.daily_challenge_archive_v15_6
select challenge.*
from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version, '') <> '12.2'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-6-2-STABLE'
  )
on conflict (challenge_date, difficulty) do update
set
  seed = excluded.seed,
  encoded_board = excluded.encoded_board,
  board_hash = excluded.board_hash,
  dataset_version = excluded.dataset_version,
  rules_version = excluded.rules_version,
  category_set_version = excluded.category_set_version,
  created_at = excluded.created_at;

insert into public.v15_6_2_removed_daily_challenges(challenge_date, difficulty)
select challenge.challenge_date, challenge.difficulty
from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and (
    coalesce(challenge.rules_version, '') <> '12.2'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-6-2-STABLE'
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
    coalesce(challenge.rules_version, '') <> '12.2'
    or coalesce(challenge.category_set_version, '') <> 'SCOUT-ADVENTURER-EXPERT-V15-6-2-STABLE'
  )
  and not exists (
    select 1
    from public.daily_scores score
    where score.challenge_date = challenge.challenge_date
      and score.difficulty = challenge.difficulty
  );

commit;

-- Summary outputs.
select action, count(*) as categories
from public.v15_6_2_decisions
group by action
order by action;

select
  count(*) filter (where needs_manual_copy_review) as manual_copy_review,
  count(*) filter (where not needs_manual_copy_review) as copy_pass,
  count(*) as audited_categories
from public.category_copy_audit_v15_6_2;

select
  count(*) as remaining_random_editorial_outcomes
from public.category_catalog_editorial_v15_6
where editorial_outcome = 'random';
