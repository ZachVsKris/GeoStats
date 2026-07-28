-- GeoStats v15.0.0: authoritative category-review workbench
-- Adds a single editorial decision, structured reasons, an audit trail, and a
-- strict playability view that no longer requires every legacy review column
-- to be populated simultaneously.

begin;

create table if not exists public.v15_category_state_backup (
  category_id text primary key,
  title text not null,
  short_title text,
  semantic_family text,
  review_status text,
  curation_status text,
  curation_reason text,
  curation_version text,
  content_review_status text,
  content_review_reason text,
  content_review_version text,
  player_quality_status text,
  player_quality_reason text,
  player_source_url text,
  player_source_status text,
  player_source_reason text,
  player_source_checked_at timestamptz,
  link_quality_score integer,
  enabled boolean,
  eligible_daily boolean,
  captured_at timestamptz not null default now()
);

-- Keep the installer idempotent if an early v15 draft created a narrower backup.
alter table public.v15_category_state_backup add column if not exists curation_status text;
alter table public.v15_category_state_backup add column if not exists curation_reason text;
alter table public.v15_category_state_backup add column if not exists curation_version text;
alter table public.v15_category_state_backup add column if not exists content_review_status text;
alter table public.v15_category_state_backup add column if not exists content_review_reason text;
alter table public.v15_category_state_backup add column if not exists content_review_version text;
alter table public.v15_category_state_backup add column if not exists player_quality_status text;
alter table public.v15_category_state_backup add column if not exists player_quality_reason text;
alter table public.v15_category_state_backup add column if not exists player_source_url text;
alter table public.v15_category_state_backup add column if not exists player_source_status text;
alter table public.v15_category_state_backup add column if not exists player_source_reason text;
alter table public.v15_category_state_backup add column if not exists player_source_checked_at timestamptz;
alter table public.v15_category_state_backup add column if not exists link_quality_score integer;

insert into public.v15_category_state_backup (
  category_id,title,short_title,semantic_family,review_status,
  curation_status,curation_reason,curation_version,
  content_review_status,content_review_reason,content_review_version,
  player_quality_status,player_quality_reason,
  player_source_url,player_source_status,player_source_reason,player_source_checked_at,link_quality_score,
  enabled,eligible_daily
)
select id,title,short_title,semantic_family,review_status,
       curation_status,curation_reason,curation_version,
       content_review_status,content_review_reason,content_review_version,
       player_quality_status,player_quality_reason,
       player_source_url,player_source_status,player_source_reason,player_source_checked_at,link_quality_score,
       enabled,eligible_daily
from public.stat_categories
on conflict (category_id) do nothing;

-- Self-contained player-link policy. Exact pages are preferred, while a safe
-- official data portal is acceptable when a source cannot expose a stable
-- human-readable filtered page.
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

create or replace function public.general_official_source_page_v15(p_source_organization text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_source_organization,''))
    when 'world bank' then 'https://data.worldbank.org/indicator/'
    when 'faostat' then 'https://www.fao.org/faostat/en/'
    when 'who' then 'https://www.who.int/data/gho/data'
    when 'unesco' then 'https://databrowser.uis.unesco.org/'
    when 'unesco uis' then 'https://databrowser.uis.unesco.org/'
    when 'ilostat' then 'https://ilostat.ilo.org/data/'
    when 'natural earth' then 'https://www.naturalearthdata.com/'
    when 'un comtrade' then 'https://comtradeplus.un.org/'
    when 'u.s. eia' then 'https://www.eia.gov/international/data/world'
    when 'eia' then 'https://www.eia.gov/international/data/world'
    when 'unhcr' then 'https://www.unhcr.org/refugee-statistics/'
    when 'un tourism' then 'https://www.unwto.org/tourism-statistics'
    when 'imf' then 'https://data.imf.org/'
    when 'oecd' then 'https://data-explorer.oecd.org/'
    when 'un population division' then 'https://www.un.org/development/desa/pd/content/international-data'
    when 'united nations population division' then 'https://www.un.org/development/desa/pd/content/international-data'
    else null
  end
$$;

-- Repair the link regression that left strong legacy sources at pending. This
-- does not approve a category; it only gives reviewers and players a safe,
-- official page when the category later passes integrity and editorial review.
update public.stat_categories
set player_source_url = 'https://data.worldbank.org/indicator/' || source_indicator_code,
    player_source_status = 'exact',
    player_source_reason = 'Exact human-readable World Bank indicator page.',
    player_source_checked_at = now(),
    link_quality_score = 100,
    updated_at = now()
where source_organization = 'World Bank'
  and source_indicator_code is not null
  and source_indicator_code ~ '^[A-Za-z0-9._-]+$';

update public.stat_categories category
set player_source_url = coalesce(
      case when public.player_source_url_is_safe(category.player_source_url) then category.player_source_url end,
      case when public.player_source_url_is_safe(category.source_page_url) then category.source_page_url end,
      case when public.player_source_url_is_safe(category.source_url) then category.source_url end,
      case when public.player_source_url_is_safe(category.methodology_url) then category.methodology_url end,
      public.general_official_source_page_v15(category.source_organization)
    ),
    player_source_status = case
      when category.player_source_status = 'exact' and public.player_source_url_is_safe(category.player_source_url) then 'exact'
      else 'general'
    end,
    player_source_reason = case
      when category.player_source_status = 'exact' and public.player_source_url_is_safe(category.player_source_url)
        then coalesce(category.player_source_reason, 'Exact audited human-readable data page.')
      else 'General human-readable official data portal; an exact stable shareable view is unavailable.'
    end,
    player_source_checked_at = now(),
    link_quality_score = case
      when category.player_source_status = 'exact' and public.player_source_url_is_safe(category.player_source_url)
        then greatest(coalesce(category.link_quality_score,100),90)
      else 70
    end,
    updated_at = now()
where category.source_organization <> 'World Bank'
  and public.general_official_source_page_v15(category.source_organization) is not null;

create table if not exists public.category_review_state (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','duplicate','needs_rewrite','needs_discussion')),
  political_self_reported boolean not null default false,
  confusing boolean not null default false,
  esoteric boolean not null default false,
  subjective_or_composite boolean not null default false,
  stale_data boolean not null default false,
  poor_coverage boolean not null default false,
  duplicate_of text references public.stat_categories(id) on delete set null,
  recommended_title text,
  semantic_group text,
  notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists category_review_state_status_idx
  on public.category_review_state(status, updated_at desc);
create index if not exists category_review_state_semantic_idx
  on public.category_review_state(semantic_group);
create index if not exists category_review_state_flags_idx
  on public.category_review_state(political_self_reported, confusing, esoteric, subjective_or_composite);

create table if not exists public.category_review_events_v15 (
  id bigint generated by default as identity primary key,
  category_id text not null references public.stat_categories(id) on delete cascade,
  reviewer_user_id uuid not null,
  previous_state jsonb not null default '{}'::jsonb,
  next_state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists category_review_events_v15_category_idx
  on public.category_review_events_v15(category_id, created_at desc);

alter table public.category_review_state enable row level security;
alter table public.category_review_events_v15 enable row level security;
revoke all on public.category_review_state from public, anon, authenticated;
revoke all on public.category_review_events_v15 from public, anon, authenticated;
grant all on public.category_review_state to service_role;
grant all on public.category_review_events_v15 to service_role;
grant usage, select on sequence public.category_review_events_v15_id_seq to service_role;

-- Preserve prior editorial work, but reduce it to one understandable state.
insert into public.category_review_state (
  category_id,
  status,
  political_self_reported,
  confusing,
  esoteric,
  subjective_or_composite,
  stale_data,
  poor_coverage,
  recommended_title,
  semantic_group,
  notes,
  reviewed_at
)
select
  category.id,
  case
    when category.content_review_status = 'excluded'
      or category.curation_status = 'excluded'
      or category.review_status = 'rejected'
      or category.player_quality_status = 'blocked'
      then 'rejected'
    when category.review_status = 'approved'
      or category.curation_status = 'approved'
      or category.content_review_status = 'approved'
      then 'approved'
    else 'pending'
  end,
  false,
  false,
  false,
  false,
  case
    when coalesce(category.common_year, category.latest_available_year) is null then false
    else coalesce(category.common_year, category.latest_available_year) < greatest(category.minimum_year, 2022)
  end,
  greatest(coalesce(category.common_year_coverage, 0), coalesce(category.country_coverage, 0)) between 1 and 29,
  null,
  nullif(category.semantic_family, ''),
  coalesce(category.curation_reason, category.content_review_reason, category.player_quality_reason),
  case
    when category.review_status = 'approved'
      or category.curation_status in ('approved','excluded')
      or category.content_review_status in ('approved','excluded')
      then now()
    else null
  end
from public.stat_categories category
on conflict (category_id) do nothing;

-- Permanent high-confidence exclusions requested for GeoStats. These patterns
-- are intentionally narrow; ambiguous measures remain in needs_discussion.
update public.category_review_state review
set status = 'rejected',
    political_self_reported = case
      when lower(category.title || ' ' || coalesce(category.description,'')) ~ '(internet usage|internet users|internet access|internet coverage|individuals using the internet|government effectiveness|political stability)'
        or category.source_indicator_code = 'IT.NET.USER.ZS' then true
      else review.political_self_reported
    end,
    confusing = case
      when lower(category.title) ~ '(labor.?income share|output per worker|employment.?to.?population)' then true
      else review.confusing
    end,
    esoteric = case
      when lower(category.title) ~ '(labor.?income share|output per worker|employment.?to.?population)' then true
      else review.esoteric
    end,
    subjective_or_composite = case
      when lower(category.title) ~ '(happiness|corruption perceptions?|freedom index|democracy index|government effectiveness|political stability)' then true
      else review.subjective_or_composite
    end,
    notes = coalesce(review.notes || E'\n', '') || 'Automatically placed on the permanent GeoStats exclusion list in v15.0.',
    reviewed_at = coalesce(review.reviewed_at, now()),
    updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and (
    lower(category.title || ' ' || coalesce(category.description,'')) ~ '(happiness|corruption perceptions?|freedom index|democracy index|government effectiveness|political stability|internet usage|internet users|internet access|internet coverage|individuals using the internet|labor.?income share|output per worker|employment.?to.?population)'
    or category.source_indicator_code = 'IT.NET.USER.ZS'
  );

-- Broad survey/perception terms are surfaced for review rather than silently approved.
update public.category_review_state review
set status = case when review.status = 'pending' then 'needs_discussion' else review.status end,
    subjective_or_composite = true,
    updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and lower(category.title || ' ' || coalesce(category.description,'')) ~ '(self.?reported|survey.?based|perception|satisfaction|subjective|composite index)'
  and review.status not in ('rejected','duplicate');


-- Every future importer row automatically enters the review queue. Importers
-- never need to know about the editorial schema.
create or replace function public.ensure_category_review_state_v15()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  normalized text := lower(new.title || ' ' || coalesce(new.description,''));
  hard_reject boolean := normalized ~ '(happiness|corruption perceptions?|freedom index|democracy index|government effectiveness|political stability|internet usage|internet users|internet access|internet coverage|individuals using the internet|labor.?income share|output per worker|employment.?to.?population)';
  discussion boolean := normalized ~ '(self.?reported|survey.?based|perception|satisfaction|subjective|composite index)';
begin
  insert into public.category_review_state (
    category_id,status,political_self_reported,confusing,esoteric,
    subjective_or_composite,stale_data,poor_coverage,semantic_group,notes
  ) values (
    new.id,
    case when hard_reject then 'rejected' when discussion then 'needs_discussion' else 'pending' end,
    normalized ~ '(internet usage|internet users|internet access|internet coverage|individuals using the internet|government effectiveness|political stability)',
    normalized ~ '(labor.?income share|output per worker|employment.?to.?population)',
    normalized ~ '(labor.?income share|output per worker|employment.?to.?population)',
    normalized ~ '(happiness|corruption perceptions?|freedom index|democracy index|government effectiveness|political stability|self.?reported|survey.?based|perception|satisfaction|subjective|composite index)',
    case when coalesce(new.common_year,new.latest_available_year) is null then false else coalesce(new.common_year,new.latest_available_year) < greatest(new.minimum_year,2022) end,
    greatest(coalesce(new.common_year_coverage,0),coalesce(new.country_coverage,0)) between 1 and 29,
    nullif(new.semantic_family,''),
    case when hard_reject then 'Automatically placed on the permanent GeoStats exclusion list in v15.0.' when discussion then 'Automatically routed to Needs discussion by the v15 intake screen.' else null end
  )
  on conflict (category_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stat_categories_v15_review_intake on public.stat_categories;
create trigger stat_categories_v15_review_intake
after insert on public.stat_categories
for each row execute function public.ensure_category_review_state_v15();

create or replace function public.category_v15_source_is_official(p_source text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_source,'')) in (
    'world bank','faostat','who','unesco','unesco uis','ilostat','natural earth',
    'un comtrade','u.s. eia','eia','unhcr','un tourism','imf','oecd',
    'un population division','united nations population division'
  )
$$;


create or replace function public.category_v15_true_integrity_failure(
  p_status text,
  p_reason text,
  p_value_mismatches integer,
  p_ranking_mismatches integer
)
returns boolean
language sql
immutable
as $$
  select coalesce(p_value_mismatches,0) > 0
      or coalesce(p_ranking_mismatches,0) > 0
      or (
        coalesce(p_status,'') = 'failed'
        and coalesce(p_reason,'') ~* '(value mismatch|ranking mismatch|unexpected stored countr|official countries missing|duplicate countr|snapshot unique)'
      )
$$;

create or replace view public.category_review_queue_v15
with (security_invoker=true)
as
select
  category.*,
  review.status as editorial_status,
  review.political_self_reported,
  review.confusing,
  review.esoteric,
  review.subjective_or_composite,
  review.stale_data,
  review.poor_coverage,
  review.duplicate_of,
  review.recommended_title,
  review.semantic_group,
  review.notes as editorial_notes,
  review.reviewed_by,
  review.reviewed_at,
  review.updated_at as editorial_updated_at,
  coalesce(nullif(review.recommended_title,''), category.title) as effective_title,
  coalesce(nullif(review.semantic_group,''), nullif(category.semantic_family,''), nullif(category.concept_group,''), category.family) as effective_semantic_group,
  (
    public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(category.validation_status, category.validation_reason, category.validation_mismatch_count, category.validation_ranking_mismatch_count)
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(coalesce(category.common_year_coverage,0), coalesce(category.country_coverage,0)) >= 30
    and coalesce(category.common_year, category.latest_available_year, 0) >= greatest(category.minimum_year, 2022)
    and category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as hard_gate_ready,
  (
    review.status = 'approved'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
  ) as editorial_ready,
  (
    review.status = 'approved'
    and not review.political_self_reported
    and not review.confusing
    and not review.esoteric
    and not review.subjective_or_composite
    and not review.stale_data
    and not review.poor_coverage
    and review.duplicate_of is null
    and public.category_v15_source_is_official(category.source_organization)
    and not public.category_v15_true_integrity_failure(category.validation_status, category.validation_reason, category.validation_mismatch_count, category.validation_ranking_mismatch_count)
    and coalesce(category.quality_score, 0) >= 70
    and coalesce(category.credibility_status, 'approved') <> 'quarantined'
    and coalesce(category.credibility_score, 75) >= 75
    and greatest(coalesce(category.common_year_coverage,0), coalesce(category.country_coverage,0)) >= 30
    and coalesce(category.common_year, category.latest_available_year, 0) >= greatest(category.minimum_year, 2022)
    and category.player_source_status in ('exact','general')
    and public.player_source_url_is_safe(category.player_source_url)
  ) as computed_playable_v15,
  array_remove(array[
    case when not public.category_v15_source_is_official(category.source_organization) then 'Source is not on the official-source allowlist.' end,
    case when public.category_v15_true_integrity_failure(category.validation_status, category.validation_reason, category.validation_mismatch_count, category.validation_ranking_mismatch_count) then 'A direct value, country-set, duplicate, or ranking integrity failure was found.' when category.validation_status is distinct from 'verified' then 'Official-source verification is pending or produced a non-blocking warning.' end,
    case when coalesce(category.quality_score,0) < 70 then 'Quality score is below 70.' end,
    case when category.credibility_status = 'quarantined' or coalesce(category.credibility_score,75) < 75 then 'Credibility review did not pass.' end,
    case when greatest(coalesce(category.common_year_coverage,0), coalesce(category.country_coverage,0)) < 30 then 'Fewer than 30 countries have comparable data.' end,
    case when coalesce(category.common_year,category.latest_available_year,0) < greatest(category.minimum_year,2022) then 'Comparable data are too old.' end,
    case when category.player_source_status not in ('exact','general') or not public.player_source_url_is_safe(category.player_source_url) then 'No safe human-readable official source page is available.' end,
    case when review.status <> 'approved' then 'Editorial decision is not approved.' end,
    case when review.political_self_reported then 'Flagged as politically vulnerable or self-reported.' end,
    case when review.subjective_or_composite then 'Flagged as subjective, perception-based, or composite.' end,
    case when review.confusing then 'Flagged as difficult to understand.' end,
    case when review.esoteric then 'Flagged as too esoteric for gameplay.' end,
    case when review.stale_data then 'Flagged as stale.' end,
    case when review.poor_coverage then 'Flagged for poor coverage.' end,
    case when review.duplicate_of is not null then 'Marked as a duplicate.' end
  ], null) as v15_blockers
from public.stat_categories category
join public.category_review_state review on review.category_id = category.id;

revoke all on public.category_review_queue_v15 from public, anon, authenticated;
grant select on public.category_review_queue_v15 to service_role;

create or replace function public.reconcile_category_playability_v15()
returns table(playable integer, blocked integer, editorial_approved integer, integrity_ready integer)
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories category
  set title = case
        when queue.computed_playable_v15 and nullif(queue.recommended_title,'') is not null
          then queue.recommended_title
        else category.title
      end,
      short_title = case
        when queue.computed_playable_v15 and nullif(queue.recommended_title,'') is not null
          then left(queue.recommended_title,70)
        else category.short_title
      end,
      semantic_family = coalesce(nullif(queue.semantic_group,''), category.semantic_family),
      review_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'rejected'
        else 'needs_review'
      end,
      curation_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end,
      curation_reason = 'GeoStats v15 authoritative category review state: ' || queue.editorial_status || '.',
      curation_version = 'geostats-v15.1-review-v2',
      content_review_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end,
      content_review_reason = 'GeoStats v15 authoritative category review state: ' || queue.editorial_status || '.',
      content_review_version = 'geostats-v15.1-review-v2',
      player_quality_status = case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'blocked'
        else 'caution'
      end,
      player_quality_reason = 'GeoStats v15 authoritative category review state: ' || queue.editorial_status || '.',
      enabled = queue.computed_playable_v15,
      eligible_daily = queue.computed_playable_v15,
      updated_at = now()
  from public.category_review_queue_v15 queue
  where queue.id = category.id
    and (
      category.enabled is distinct from queue.computed_playable_v15
      or category.eligible_daily is distinct from queue.computed_playable_v15
      or category.review_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'rejected'
        else 'needs_review'
      end
      or category.curation_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end
      or category.content_review_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'excluded'
        else 'pending'
      end
      or category.player_quality_status is distinct from case
        when queue.editorial_status = 'approved' then 'approved'
        when queue.editorial_status in ('rejected','duplicate') then 'blocked'
        else 'caution'
      end
      or (queue.computed_playable_v15 and nullif(queue.recommended_title,'') is not null and category.title is distinct from queue.recommended_title)
      or (nullif(queue.semantic_group,'') is not null and category.semantic_family is distinct from queue.semantic_group)
    );

  return query
  select
    count(*) filter (where computed_playable_v15)::integer,
    count(*) filter (where not computed_playable_v15)::integer,
    count(*) filter (where editorial_status='approved')::integer,
    count(*) filter (where hard_gate_ready)::integer
  from public.category_review_queue_v15;
end;
$$;

revoke all on function public.reconcile_category_playability_v15() from public, anon, authenticated;
grant execute on function public.reconcile_category_playability_v15() to service_role;

create or replace view public.category_review_overview_v15
with (security_invoker=true)
as
select
  count(*)::bigint as categories,
  count(*) filter (where editorial_status='pending')::bigint as pending,
  count(*) filter (where editorial_status='approved')::bigint as approved,
  count(*) filter (where editorial_status='rejected')::bigint as rejected,
  count(*) filter (where editorial_status='duplicate')::bigint as duplicates,
  count(*) filter (where editorial_status='needs_rewrite')::bigint as needs_rewrite,
  count(*) filter (where editorial_status='needs_discussion')::bigint as needs_discussion,
  count(*) filter (where hard_gate_ready)::bigint as hard_gate_ready,
  count(*) filter (where computed_playable_v15)::bigint as playable,
  count(*) filter (where political_self_reported)::bigint as political_self_reported,
  count(*) filter (where confusing or esoteric)::bigint as confusing_or_esoteric,
  count(*) filter (where subjective_or_composite)::bigint as subjective_or_composite
from public.category_review_queue_v15;

revoke all on public.category_review_overview_v15 from public, anon, authenticated;
grant select on public.category_review_overview_v15 to service_role;

select * from public.reconcile_category_playability_v15();

commit;
