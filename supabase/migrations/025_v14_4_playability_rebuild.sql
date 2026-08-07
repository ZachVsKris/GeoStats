-- GeoStats v14.4.0 consolidated playability and Daily reliability patch
-- Baseline: a database that has already run RUN_THIS_IN_SUPABASE_FOR_V14_3_1.sql
-- Safe to run more than once.

begin;

-- ---------------------------------------------------------------------------
-- 1. Player-source quality is independent from data trust and playability.
-- ---------------------------------------------------------------------------

alter table public.stat_categories drop constraint if exists stat_categories_player_source_status_check;
alter table public.stat_categories add constraint stat_categories_player_source_status_check
  check (player_source_status in ('pending','exact','general','needs_exact_url','invalid','unavailable'));

create or replace function public.player_source_url_is_safe(p_url text)
returns boolean
language sql
immutable
as $$
  select p_url is not null
    and p_url ~ '^https://'
    and p_url !~* '(^|[./])(api|comtradeapi)[.]'
    and p_url !~* '[.]((csv|tsv|json|xml|zip|gz|gzip|xlsx?|parquet))([?#]|$)'
    and p_url !~* '/(api|bulk|download|downloads)(/|$)'
    and p_url !~* '([?&])(format|download|output|type)=(csv|tsv|json|xml|zip|xlsx?|parquet)(&|$)'
    and p_url !~* '([?&])(download|attachment)='
$$;

create or replace function public.general_official_source_page(p_source_organization text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_source_organization,''))
    when 'world bank' then 'https://data.worldbank.org/indicator/'
    when 'faostat' then 'https://www.fao.org/faostat/en/'
    when 'who' then 'https://www.who.int/data/gho/data'
    when 'unesco' then 'https://databrowser.uis.unesco.org/'
    when 'ilostat' then 'https://ilostat.ilo.org/data/'
    when 'natural earth' then 'https://www.naturalearthdata.com/'
    when 'un comtrade' then 'https://comtradeplus.un.org/'
    when 'u.s. eia' then 'https://www.eia.gov/international/data/world'
    when 'eia' then 'https://www.eia.gov/international/data/world'
    when 'unhcr' then 'https://www.unhcr.org/refugee-statistics/'
    when 'un tourism' then 'https://www.unwto.org/tourism-statistics'
    else null
  end
$$;

-- Replace the v14.3.1 exact-link trigger. The replacement sanitizes dangerous
-- links but never silently changes enabled or eligible_daily.
create or replace function public.enforce_content_and_player_link_gate()
returns trigger
language plpgsql
as $$
begin
  if new.player_source_url is not null and not public.player_source_url_is_safe(new.player_source_url) then
    new.player_source_url := null;
    new.player_source_status := 'invalid';
    new.player_source_reason := 'Rejected because the URL is an API, raw file, bulk download, attachment, or non-HTTPS resource.';
    new.link_quality_score := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists stat_categories_content_player_link_gate on public.stat_categories;
create trigger stat_categories_content_player_link_gate
before insert or update on public.stat_categories
for each row execute function public.enforce_content_and_player_link_gate();

-- World Bank retains an exact indicator page.
update public.stat_categories
set player_source_url = 'https://data.worldbank.org/indicator/' || source_indicator_code,
    player_source_status = 'exact',
    player_source_reason = 'Exact human-readable World Bank indicator page.',
    player_source_checked_at = now(),
    link_quality_score = 100,
    updated_at = now()
where source_organization = 'World Bank'
  and content_review_status = 'approved'
  and source_indicator_code is not null;

-- Other approved providers may use a safe existing page or a general official
-- data portal. This is deliberately a warning tier, not a removal rule.
update public.stat_categories category
set player_source_url = coalesce(
      case when public.player_source_url_is_safe(category.player_source_url) then category.player_source_url end,
      case when public.player_source_url_is_safe(category.source_page_url) then category.source_page_url end,
      case when public.player_source_url_is_safe(category.source_url) then category.source_url end,
      case when public.player_source_url_is_safe(category.methodology_url) then category.methodology_url end,
      public.general_official_source_page(category.source_organization)
    ),
    player_source_status = case when category.player_source_status = 'exact' then 'exact' else 'general' end,
    player_source_reason = case
      when category.player_source_status = 'exact' then coalesce(category.player_source_reason,'Exact audited human-readable data page.')
      else 'General human-readable official data portal; exact shareable data view is unavailable.'
    end,
    player_source_checked_at = now(),
    link_quality_score = case when category.player_source_status = 'exact' then greatest(coalesce(category.link_quality_score,100),90) else 70 end,
    updated_at = now()
where category.content_review_status = 'approved'
  and category.source_organization <> 'World Bank'
  and public.general_official_source_page(category.source_organization) is not null;

create or replace function public.record_player_source_validation(
  p_category_id text,
  p_status text,
  p_reason text,
  p_link_quality_score integer default null
)
returns text
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_status not in ('exact','general','invalid','needs_exact_url','unavailable','pending') then
    raise exception 'Unsupported player source status: %', p_status;
  end if;

  update public.stat_categories
  set player_source_status = p_status,
      player_source_reason = p_reason,
      player_source_checked_at = case when p_status in ('exact','general','invalid','unavailable') then now() else null end,
      link_quality_score = coalesce(p_link_quality_score, case when p_status='exact' then 100 when p_status='general' then 70 else 0 end),
      updated_at = now()
  where id = p_category_id;

  if not found then raise exception 'Category not found: %', p_category_id; end if;
  return p_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. One transparent, computed playability policy.
-- ---------------------------------------------------------------------------

create or replace view public.category_playability_v144
with (security_invoker=true)
as
select
  category.*,
  (
    category.review_status = 'approved'
    and (category.curation_status is null or category.curation_status = 'approved')
    and category.validation_status = 'verified'
    and category.content_review_status = 'approved'
    and (category.quality_score is null or category.quality_score >= 70)
    and coalesce(category.credibility_status,'verified') <> 'quarantined'
    and (category.credibility_score is null or category.credibility_score >= 75)
    and (category.objective_status is null or category.objective_status = 'objective')
    and coalesce(category.player_quality_status,'approved') <> 'blocked'
    and (category.verifiability_score is null or category.verifiability_score >= 80)
    and (category.understandability_score is null or category.understandability_score >= 70)
    and (category.fun_score is null or category.fun_score >= 55)
    and (category.immediate_comprehension_score is null or category.immediate_comprehension_score >= 80)
    and (category.gameplay_interest_score is null or category.gameplay_interest_score >= 65)
    and category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as computed_playable,
  array_remove(array[
    case when category.review_status <> 'approved' then 'Editorial review is not approved.' end,
    case when category.curation_status is not null and category.curation_status <> 'approved' then 'Curation is not approved.' end,
    case when category.validation_status <> 'verified' then 'Official-source validation is not verified.' end,
    case when category.content_review_status <> 'approved' then 'Content review is not approved.' end,
    case when category.quality_score is not null and category.quality_score < 70 then 'Quality score is below 70.' end,
    case when category.credibility_status = 'quarantined' or (category.credibility_score is not null and category.credibility_score < 75) then 'Credibility review did not pass.' end,
    case when category.objective_status is not null and category.objective_status <> 'objective' then 'The metric is not classified as objective.' end,
    case when category.player_quality_status = 'blocked' then 'Player-quality review blocked this category.' end,
    case when category.verifiability_score is not null and category.verifiability_score < 80 then 'Verifiability score is below 80.' end,
    case when category.understandability_score is not null and category.understandability_score < 70 then 'Understandability score is below 70.' end,
    case when category.fun_score is not null and category.fun_score < 55 then 'Gameplay-interest score is below 55.' end,
    case when category.immediate_comprehension_score is not null and category.immediate_comprehension_score < 80 then 'Immediate-comprehension score is below 80.' end,
    case when category.gameplay_interest_score is not null and category.gameplay_interest_score < 65 then 'Editorial gameplay-interest score is below 65.' end,
    case when category.player_source_status not in ('exact','general') or not public.player_source_url_is_safe(category.player_source_url) then 'No safe human-readable official source page is available.' end
  ], null) as playability_blockers,
  array_remove(array[
    case when category.player_source_status = 'general' then 'General official source page only.' end,
    case when category.enabled is distinct from category.eligible_daily then 'Legacy enabled and eligible_daily flags disagree.' end
  ], null) as playability_warnings
from public.stat_categories category;

create or replace function public.reconcile_category_playability_v144()
returns table(playable integer, blocked integer, general_links integer, exact_links integer)
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories category
  set enabled = policy.computed_playable,
      eligible_daily = policy.computed_playable,
      updated_at = case
        when category.enabled is distinct from policy.computed_playable
          or category.eligible_daily is distinct from policy.computed_playable
        then now() else category.updated_at end
  from public.category_playability_v144 policy
  where policy.id = category.id
    and (category.enabled is distinct from policy.computed_playable
      or category.eligible_daily is distinct from policy.computed_playable);

  return query
  select
    count(*) filter (where computed_playable)::integer,
    count(*) filter (where not computed_playable)::integer,
    count(*) filter (where computed_playable and player_source_status='general')::integer,
    count(*) filter (where computed_playable and player_source_status='exact')::integer
  from public.category_playability_v144;
end;
$$;

select * from public.reconcile_category_playability_v144();

create or replace view public.category_v144_overview
with (security_invoker=true)
as
select
  count(*)::bigint as categories,
  count(*) filter (where computed_playable)::bigint as playable,
  count(*) filter (where not computed_playable)::bigint as blocked,
  count(*) filter (where computed_playable and player_source_status='exact')::bigint as exact_player_links,
  count(*) filter (where computed_playable and player_source_status='general')::bigint as general_player_links,
  count(*) filter (where review_status='approved' and validation_status<>'verified')::bigint as awaiting_source_validation
from public.category_playability_v144;

drop view if exists public.category_content_link_issues;
drop view if exists public.category_content_link_overview;

create or replace view public.category_content_link_overview
with (security_invoker=true)
as
select
  count(*)::bigint as categories,
  count(*) filter(where content_review_status='approved')::bigint as content_approved,
  count(*) filter(where content_review_status='excluded')::bigint as content_excluded,
  count(*) filter(where content_review_status='pending')::bigint as content_pending,
  count(*) filter(where content_review_status='approved' and player_source_status='exact')::bigint as exact_player_links,
  count(*) filter(where content_review_status='approved' and player_source_status='general')::bigint as general_player_links,
  count(*) filter(where content_review_status='approved' and player_source_status='pending')::bigint as links_pending,
  count(*) filter(where content_review_status='approved' and player_source_status in ('needs_exact_url','invalid','unavailable'))::bigint as links_blocked,
  count(*) filter(where computed_playable)::bigint as playable
from public.category_playability_v144;

create or replace view public.category_content_link_issues
with (security_invoker=true)
as
select id,title,source_organization,source_indicator_code,
  content_review_status,content_review_reason,immediate_comprehension_score,gameplay_interest_score,
  player_source_status,player_source_url,player_source_reason,link_quality_score,
  computed_playable,playability_blockers,playability_warnings,enabled,eligible_daily
from public.category_playability_v144
where review_status <> 'rejected'
  and (not computed_playable or cardinality(playability_warnings) > 0)
order by computed_playable, source_organization, title;

-- ---------------------------------------------------------------------------
-- 3. Observation and daily-package integrity diagnostics.
-- ---------------------------------------------------------------------------

create or replace view public.stat_observation_integrity_v144
with (security_invoker=true)
as
select
  count(*)::bigint as observations,
  count(*) filter (where country_iso3 is null or length(country_iso3) <> 3)::bigint as invalid_country_codes,
  count(*) filter (where data_year < 2022)::bigint as observations_before_2022,
  (
    select count(*)::bigint
    from (
      select category_id,country_iso3,data_year
      from public.stat_observations
      group by category_id,country_iso3,data_year
      having count(*) > 1
    ) duplicates
  ) as duplicate_category_country_year_keys
from public.stat_observations;

-- Add only a non-destructive index here. VERIFY_V14_4.sql reports duplicates;
-- it does not silently delete observations or create a constraint that could
-- fail midway through this installer.
create index if not exists stat_observations_v144_lookup_idx
  on public.stat_observations(category_id,country_iso3,data_year);

-- Ensure generation-health diagnostics exist even if migration 021 was missed.
create table if not exists public.daily_generation_runs (
  id bigint generated by default as identity primary key,
  challenge_date date not null,
  status text not null,
  source text,
  diagnostics jsonb not null default '{}'::jsonb,
  scores jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists daily_generation_runs_date_idx
  on public.daily_generation_runs(challenge_date desc,created_at desc);
alter table public.daily_generation_runs enable row level security;

revoke all on function public.record_player_source_validation(text,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_player_source_validation(text,text,text,integer) to service_role;
revoke all on function public.reconcile_category_playability_v144() from public,anon,authenticated;
grant execute on function public.reconcile_category_playability_v144() to service_role;
grant select on public.category_playability_v144 to service_role;
grant select on public.category_v144_overview to service_role;
grant select on public.category_content_link_overview to service_role;
grant select on public.category_content_link_issues to service_role;
grant select on public.stat_observation_integrity_v144 to service_role;
grant all on table public.daily_generation_runs to service_role;

commit;
