-- GeoStats v15.6.1 corrective category-copy and rules-alignment patch
--
-- Prerequisite: RUN_THIS_IN_SUPABASE_FOR_V15_6_CORRECTED.sql completed.
-- Safe to rerun. The first run captures exact category states for rollback.
--
-- This release does NOT add the expansion sources. It only applies the agreed
-- existing-category decisions and prepares the app for the later intake review.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v15.6.1-corrective'));

do $$
declare
  missing_columns text;
begin
  if to_regclass('public.category_catalog_editorial_v15_6') is null then
    raise exception 'v15.6.1 stopped: category_catalog_editorial_v15_6 is missing. Run the corrected v15.6 installer first.';
  end if;

  with required_columns(table_name, column_name) as (
    values
      ('stat_categories', 'id'),
      ('stat_categories', 'title'),
      ('stat_categories', 'short_title'),
      ('stat_categories', 'description'),
      ('stat_categories', 'plain_language_description'),
      ('stat_categories', 'technical_definition'),
      ('stat_categories', 'source_organization'),
      ('stat_categories', 'source_indicator_code'),
      ('stat_categories', 'enabled'),
      ('stat_categories', 'eligible_daily'),
      ('stat_categories', 'content_review_status'),
      ('stat_categories', 'player_quality_status'),
      ('stat_categories', 'metadata'),
      ('stat_categories', 'updated_at'),
      ('daily_challenges', 'challenge_date'),
      ('daily_challenges', 'difficulty'),
      ('daily_challenges', 'rules_version')
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
    raise exception 'v15.6.1 stopped. Missing required columns: %', missing_columns;
  end if;
end
$$;

create table if not exists public.v15_6_1_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);

insert into public.v15_6_1_category_backup(category_id, category_state)
select category.id, to_jsonb(category)
from public.stat_categories category
on conflict (category_id) do nothing;

create table if not exists public.v15_6_1_decisions (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  action text not null check (action in ('rewrite', 'daily_preferred', 'random_only', 'duplicate', 'quarantine')),
  prior_title text not null,
  player_title text,
  player_description text,
  reason text not null,
  applied_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Largest city: the official World Bank measure is Population in largest city.
-- The short copy deliberately says urban area rather than claiming city-proper
-- administrative boundaries.
-- ---------------------------------------------------------------------------
insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'rewrite',
  category.title,
  'Largest city by population',
  'Population living in each country''s largest urban area.',
  'Player-facing rewrite for World Bank indicator EN.URB.LCTY.'
from public.stat_categories category
where category.source_indicator_code = 'EN.URB.LCTY'
   or category.title ~* '^largest population in largest city$'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- ---------------------------------------------------------------------------
-- Land area: prefer an already-active World Bank land-area category. If one is
-- not active, keep the Natural Earth calculation but remove "mapped" jargon.
-- ---------------------------------------------------------------------------
insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'rewrite',
  category.title,
  'Largest land area',
  'Total land area within the country''s borders.',
  'Clear player-facing title for the official land-area measure.'
from public.stat_categories category
where category.source_indicator_code = 'AG.LND.TOTL.K2'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  mapped.id,
  case
    when exists (
      select 1
      from public.stat_categories official
      where official.source_indicator_code = 'AG.LND.TOTL.K2'
        and (official.enabled or official.eligible_daily)
    ) then 'duplicate'
    else 'rewrite'
  end,
  mapped.title,
  case
    when exists (
      select 1
      from public.stat_categories official
      where official.source_indicator_code = 'AG.LND.TOTL.K2'
        and (official.enabled or official.eligible_daily)
    ) then null
    else 'Largest land area'
  end,
  case
    when exists (
      select 1
      from public.stat_categories official
      where official.source_indicator_code = 'AG.LND.TOTL.K2'
        and (official.enabled or official.eligible_daily)
    ) then null
    else 'Total land area within the country''s borders.'
  end,
  case
    when exists (
      select 1
      from public.stat_categories official
      where official.source_indicator_code = 'AG.LND.TOTL.K2'
        and (official.enabled or official.eligible_daily)
    ) then 'Duplicate of the preferred official land-area category.'
    else 'Natural Earth land-area calculation retained because no active official duplicate exists.'
  end
from public.stat_categories mapped
where mapped.title ~* 'largest mapped land area'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- ---------------------------------------------------------------------------
-- Greenhouse gases: make the absolute-total World Bank indicator the preferred
-- concept. The technical exclusion remains in source details, not the title.
-- ---------------------------------------------------------------------------
insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'daily_preferred',
  category.title,
  'Most greenhouse gas emissions',
  'Total emissions from energy, industry, agriculture and waste, excluding land use and forestry.',
  'Preferred absolute-total greenhouse-gas concept: EN.GHG.ALL.MT.CE.AR5.'
from public.stat_categories category
where category.source_indicator_code = 'EN.GHG.ALL.MT.CE.AR5'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'duplicate',
  category.title,
  null,
  null,
  'Superseded by the absolute-total greenhouse-gas category EN.GHG.ALL.MT.CE.AR5.'
from public.stat_categories category
where (
    category.title ~* 'greenhouse gas emissions'
    or category.source_indicator_code like 'EN.GHG.%'
  )
  and category.source_indicator_code <> 'EN.GHG.ALL.MT.CE.AR5'
  and (
    category.title ~* 'per capita|per person|total greenhouse gas'
    or category.source_indicator_code in (
      'EN.GHG.ALL.PC.CE.AR5',
      'EN.GHG.TOT.ZG.AR5'
    )
  )
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- ---------------------------------------------------------------------------
-- Travel services: source titles cover several materially different measures.
-- Keep them out of gameplay until each code receives a specific player title.
-- ---------------------------------------------------------------------------
insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'quarantine',
  category.title,
  null,
  null,
  'Travel-services measures may represent exports, imports, shares or totals. Exact indicator semantics require manual review.'
from public.stat_categories category
where category.title ~* 'travel services'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- ---------------------------------------------------------------------------
-- PM2.5 and FAOSTAT Fruit Primary: retain the measure, replace source jargon.
-- ---------------------------------------------------------------------------
insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'rewrite',
  category.title,
  'Highest fine-particle air pollution',
  'Average exposure to tiny airborne particles that can enter the lungs.',
  'Plain-language rewrite for World Bank indicator EN.ATM.PM25.MC.M3.'
from public.stat_categories category
where category.source_indicator_code = 'EN.ATM.PM25.MC.M3'
   or category.title ~* 'PM2\.5 air pollution, mean annual exposure'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

insert into public.v15_6_1_decisions(
  category_id, action, prior_title, player_title, player_description, reason
)
select
  category.id,
  'rewrite',
  category.title,
  'Most fruit produced',
  'Total production of primary, unprocessed fruit crops.',
  'Plain-language rewrite of the FAOSTAT Fruit Primary aggregate; constituent-crop review remains tracked in metadata.'
from public.stat_categories category
where lower(coalesce(category.source_organization, '')) like '%fao%'
  and category.title ~* 'fruit primary'
  and category.title ~* 'produced|production'
on conflict (category_id) do update set
  action = excluded.action,
  player_title = excluded.player_title,
  player_description = excluded.player_description,
  reason = excluded.reason,
  applied_at = now();

-- Apply rewrites without overriding unrelated audit fields.
update public.stat_categories category
set
  title = decision.player_title,
  short_title = left(
    regexp_replace(decision.player_title, '^(Highest|Lowest|Largest|Most)\s+', '', 'i'),
    70
  ),
  description = decision.player_description,
  plain_language_description = decision.player_description,
  metadata = coalesce(category.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'officialSourceTitleV15_6_1',
        coalesce(category.metadata->>'officialSourceTitleV15_6_1', decision.prior_title),
      'officialDescriptionV15_6_1',
        coalesce(category.metadata->>'officialDescriptionV15_6_1', category.description),
      'catalogDecisionV15_6_1', decision.action,
      'catalogDecisionReasonV15_6_1', decision.reason
    ),
  updated_at = now()
from public.v15_6_1_decisions decision
where category.id = decision.category_id
  and decision.action in ('rewrite', 'daily_preferred')
  and decision.player_title is not null
  and decision.player_description is not null;

-- Explicit player approval of the preferred total-GHG concept. Strict source
-- integrity and computed-playability gates still apply independently.
update public.stat_categories category
set
  enabled = true,
  eligible_daily = true,
  content_review_status = 'approved',
  player_quality_status = 'approved',
  metadata = coalesce(category.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'catalogTier', 'daily',
      'strategyFamily', 'greenhouse-gas-emissions',
      'knowledgeCluster', 'greenhouse-gas-emissions',
      'preferredGreenhouseGasConceptV15_6_1', true
    ),
  updated_at = now()
where category.source_indicator_code = 'EN.GHG.ALL.MT.CE.AR5';

-- Random/Daily exclusion for duplicates and ambiguous travel-services measures.
update public.stat_categories category
set
  enabled = false,
  eligible_daily = false,
  content_review_status = case when decision.action = 'duplicate' then 'excluded' else 'pending' end,
  player_quality_status = case when decision.action = 'duplicate' then 'blocked' else 'caution' end,
  metadata = coalesce(category.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'catalogTier', 'quarantined',
      'catalogDecisionV15_6_1', decision.action,
      'catalogDecisionReasonV15_6_1', decision.reason,
      'preferredCategoryIndicatorV15_6_1',
        case
          when decision.reason like '%EN.GHG.ALL.MT.CE.AR5%' then 'EN.GHG.ALL.MT.CE.AR5'
          when decision.reason like '%land-area%' then 'AG.LND.TOTL.K2'
          else null
        end
    ),
  updated_at = now()
from public.v15_6_1_decisions decision
where category.id = decision.category_id
  and decision.action in ('duplicate', 'quarantine');

-- Keep the v15.6 editorial layer synchronized.
update public.category_catalog_editorial_v15_6 editorial
set
  player_title = coalesce(decision.player_title, editorial.player_title),
  player_description = coalesce(decision.player_description, editorial.player_description),
  editorial_outcome = case
    when decision.action = 'duplicate' then 'duplicate'
    when decision.action = 'quarantine' then 'quarantined'
    when decision.action = 'random_only' then 'random'
    else 'rewrite'
  end,
  decision_reason = decision.reason,
  decision_source = 'v15.6.1 corrective patch',
  reviewed_at = now()
from public.v15_6_1_decisions decision
where editorial.category_id = decision.category_id;

-- ---------------------------------------------------------------------------
-- Rules alignment. The corrected v15.6 database installer established 12.2,
-- while the repository still advertised 12.0. Archive mismatched current/future
-- boards, then remove only unscored ones so the 12.2 app can regenerate safely.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_archive_v15_6
  (like public.daily_challenges including all);

insert into public.daily_challenge_archive_v15_6
select challenge.*
from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2'
on conflict (challenge_date, difficulty) do update
set
  seed = excluded.seed,
  encoded_board = excluded.encoded_board,
  board_hash = excluded.board_hash,
  dataset_version = excluded.dataset_version,
  rules_version = excluded.rules_version,
  category_set_version = excluded.category_set_version,
  created_at = excluded.created_at;

delete from public.daily_challenges challenge
where challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2'
  and not exists (
    select 1
    from public.daily_scores score
    where score.challenge_date = challenge.challenge_date
      and score.difficulty = challenge.difficulty
  );

commit;

select
  action,
  count(*) as categories
from public.v15_6_1_decisions
group by action
order by action;

select
  id,
  title,
  plain_language_description,
  source_indicator_code,
  enabled,
  eligible_daily,
  content_review_status,
  player_quality_status
from public.stat_categories
where id in (select category_id from public.v15_6_1_decisions)
order by title;
