-- GeoStats v13.2 complete database installer
-- Safe to rerun. It applies the v13 canonical layer and activates WHO, UNESCO UIS, ILOSTAT, and Natural Earth.

-- GeoStats v13.0
-- Unified importer metadata, canonical category layer, and source-agnostic bulk review.
-- Safe to run after migration 010.

begin;

create extension if not exists pgcrypto;

alter table public.stat_categories
  add column if not exists canonical_category_id uuid,
  add column if not exists canonical_match_status text not null default 'unmatched',
  add column if not exists canonical_match_score smallint,
  add column if not exists recognizability_score smallint,
  add column if not exists specificity_score smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stat_categories_canonical_match_status_check'
      and conrelid = 'public.stat_categories'::regclass
  ) then
    alter table public.stat_categories
      add constraint stat_categories_canonical_match_status_check
      check (canonical_match_status in ('unmatched','suggested','linked','rejected'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'stat_categories_editorial_scores_check'
      and conrelid = 'public.stat_categories'::regclass
  ) then
    alter table public.stat_categories
      add constraint stat_categories_editorial_scores_check
      check (
        (canonical_match_score is null or canonical_match_score between 0 and 100)
        and (recognizability_score is null or recognizability_score between 0 and 100)
        and (specificity_score is null or specificity_score between 0 and 100)
      );
  end if;
end $$;

create table if not exists public.canonical_stat_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  family text not null,
  icon text,
  unit text not null,
  value_type text not null check (value_type in ('total','per_capita','percentage','rate','index','other')),
  ranking_direction text not null check (ranking_direction in ('high','low')),
  review_status text not null default 'candidate'
    check (review_status in ('candidate','approved','rejected','retired')),
  preferred_source_category_id text references public.stat_categories(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.canonical_stat_category_sources (
  canonical_category_id uuid not null references public.canonical_stat_categories(id) on delete cascade,
  source_category_id text not null references public.stat_categories(id) on delete cascade,
  priority smallint not null default 100,
  source_role text not null default 'candidate'
    check (source_role in ('preferred','fallback','component','candidate')),
  transform jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (canonical_category_id, source_category_id)
);

alter table public.canonical_stat_categories enable row level security;
alter table public.canonical_stat_category_sources enable row level security;

drop trigger if exists canonical_stat_categories_set_updated_at on public.canonical_stat_categories;
create trigger canonical_stat_categories_set_updated_at
before update on public.canonical_stat_categories
for each row execute function public.set_updated_at();

drop trigger if exists canonical_stat_category_sources_set_updated_at on public.canonical_stat_category_sources;
create trigger canonical_stat_category_sources_set_updated_at
before update on public.canonical_stat_category_sources
for each row execute function public.set_updated_at();

create unique index if not exists canonical_stat_sources_source_unique
  on public.canonical_stat_category_sources (source_category_id);
create index if not exists canonical_stat_sources_category_idx
  on public.canonical_stat_category_sources (source_category_id);
create index if not exists canonical_stat_sources_priority_idx
  on public.canonical_stat_category_sources (canonical_category_id, priority);
create index if not exists stat_categories_canonical_idx
  on public.stat_categories (canonical_category_id);
create index if not exists stat_categories_recognizability_idx
  on public.stat_categories (recognizability_score desc, specificity_score desc);

alter table public.stat_categories
  drop constraint if exists stat_categories_canonical_category_id_fkey;
alter table public.stat_categories
  add constraint stat_categories_canonical_category_id_fkey
  foreign key (canonical_category_id)
  references public.canonical_stat_categories(id)
  on delete set null;

create or replace function public.refresh_canonical_preferred_source(p_canonical_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen text;
begin
  select links.source_category_id
    into chosen
  from public.canonical_stat_category_sources links
  join public.stat_categories source_category on source_category.id = links.source_category_id
  where links.canonical_category_id = p_canonical_id
    and source_category.review_status = 'approved'
    and source_category.enabled = true
  order by links.priority asc, source_category.quality_score desc nulls last, links.source_category_id
  limit 1;

  update public.canonical_stat_categories
  set preferred_source_category_id = chosen,
      review_status = case
        when review_status in ('rejected','retired') then review_status
        when chosen is null then 'candidate'
        else 'approved'
      end,
      updated_at = now()
  where id = p_canonical_id;

  update public.canonical_stat_category_sources
  set source_role = case
      when source_category_id = chosen then 'preferred'
      when source_role = 'component' then 'component'
      else 'fallback'
    end,
    updated_at = now()
  where canonical_category_id = p_canonical_id;
end;
$$;

create or replace function public.link_stat_category_to_canonical(
  p_slug text,
  p_title text,
  p_description text,
  p_family text,
  p_icon text,
  p_unit text,
  p_value_type text,
  p_ranking_direction text,
  p_source_category_id text,
  p_priority smallint default 100,
  p_role text default 'candidate'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  canonical_id uuid;
  old_canonical_id uuid;
begin
  insert into public.canonical_stat_categories (
    slug, title, description, family, icon, unit, value_type, ranking_direction
  ) values (
    p_slug, p_title, p_description, p_family, p_icon, p_unit, p_value_type, p_ranking_direction
  )
  on conflict (slug) do update set
    description = case
      when length(excluded.description) > length(public.canonical_stat_categories.description)
      then excluded.description else public.canonical_stat_categories.description end,
    updated_at = now()
  returning id into canonical_id;

  select links.canonical_category_id
    into old_canonical_id
  from public.canonical_stat_category_sources links
  where links.source_category_id = p_source_category_id
  limit 1;

  delete from public.canonical_stat_category_sources
  where source_category_id = p_source_category_id
    and canonical_category_id <> canonical_id;

  insert into public.canonical_stat_category_sources (
    canonical_category_id, source_category_id, priority, source_role
  ) values (
    canonical_id, p_source_category_id, p_priority, p_role
  )
  on conflict (canonical_category_id, source_category_id) do update set
    priority = excluded.priority,
    source_role = excluded.source_role,
    updated_at = now();

  update public.stat_categories
  set canonical_category_id = canonical_id,
      canonical_match_status = 'linked',
      canonical_match_score = 100,
      updated_at = now()
  where id = p_source_category_id;

  if old_canonical_id is not null and old_canonical_id <> canonical_id then
    perform public.refresh_canonical_preferred_source(old_canonical_id);
  end if;
  perform public.refresh_canonical_preferred_source(canonical_id);
  return canonical_id;
end;
$$;

-- Per-category overload used by the generic importer. Migration 010's
-- two-argument source/dataset cleanup function remains available to FAOSTAT.
create or replace function public.clear_stat_source_observations(p_category_id text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  removed bigint;
begin
  delete from public.stat_observations where category_id = p_category_id;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.clear_stat_source_observations(text) from public, anon, authenticated;
grant execute on function public.clear_stat_source_observations(text) to service_role;
revoke all on function public.link_stat_category_to_canonical(text,text,text,text,text,text,text,text,text,smallint,text) from public, anon, authenticated;
grant execute on function public.link_stat_category_to_canonical(text,text,text,text,text,text,text,text,text,smallint,text) to service_role;

create or replace function public.refresh_canonical_after_source_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.canonical_category_id is not null then
    perform public.refresh_canonical_preferred_source(new.canonical_category_id);
  end if;
  return new;
end;
$$;

drop trigger if exists refresh_canonical_after_source_change on public.stat_categories;
create trigger refresh_canonical_after_source_change
after update of review_status, enabled, quality_score, canonical_category_id
on public.stat_categories
for each row execute function public.refresh_canonical_after_source_change();

-- Seed the canonical layer from categories already approved before v13.
with approved as (
  select
    category.*,
    trim(both '-' from regexp_replace(lower(category.title), '[^a-z0-9]+', '-', 'g')) as generated_slug
  from public.stat_categories category
  where category.review_status = 'approved'
), inserted as (
  insert into public.canonical_stat_categories (
    slug, title, description, family, icon, unit, value_type, ranking_direction, review_status
  )
  select
    generated_slug,
    title,
    description,
    family,
    icon,
    unit,
    value_type,
    ranking_direction,
    'approved'
  from approved
  where generated_slug <> ''
  on conflict (slug) do nothing
  returning id, slug
)
select count(*) from inserted;

insert into public.canonical_stat_category_sources (
  canonical_category_id, source_category_id, priority, source_role
)
select
  canonical.id,
  category.id,
  case when category.source_organization = 'World Bank' then 40 else 50 end,
  'preferred'
from public.stat_categories category
join public.canonical_stat_categories canonical
  on canonical.slug = trim(both '-' from regexp_replace(lower(category.title), '[^a-z0-9]+', '-', 'g'))
where category.review_status = 'approved'
on conflict (canonical_category_id, source_category_id) do nothing;

update public.stat_categories category
set canonical_category_id = canonical.id,
    canonical_match_status = 'linked',
    canonical_match_score = 100
from public.canonical_stat_categories canonical
where category.review_status = 'approved'
  and canonical.slug = trim(both '-' from regexp_replace(lower(category.title), '[^a-z0-9]+', '-', 'g'))
  and category.canonical_category_id is null;

do $$
declare
  row record;
begin
  for row in select id from public.canonical_stat_categories loop
    perform public.refresh_canonical_preferred_source(row.id);
  end loop;
end $$;

-- WHO becomes an active source. The other planned sources stay quarantined until
-- their importers are added in later releases.
insert into public.data_sources(id, name, description, status, display_order, metadata)
values (
  'who',
  'WHO',
  'Curated country-level health indicators from the WHO Global Health Observatory OData API.',
  'active',
  30,
  jsonb_build_object(
    'dataset', 'Global Health Observatory',
    'workflow', 'import-who.yml',
    'api', 'https://ghoapi.azureedge.net/api',
    'documentation', 'https://www.who.int/data/gho/info/gho-odata-api',
    'intake_policy', 'geostats-v13.0-strict',
    'review_required', true,
    'canonical_layer', true
  )
)
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  display_order = excluded.display_order,
  metadata = coalesce(public.data_sources.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

update public.data_sources
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'workflow', 'import-faostat.yml',
  'intake_policy', 'geostats-v13.0-strict',
  'canonical_layer', true
), updated_at = now()
where id = 'faostat';

commit;


-- GeoStats v13.1
-- Activates the UNESCO UIS, ILOSTAT, and Natural Earth importers.
-- All imported categories remain quarantined until administrator approval.

begin;

insert into public.data_sources(id, name, description, status, display_order, metadata)
values
  (
    'unesco',
    'UNESCO UIS',
    'Curated education, science, research, and school-infrastructure indicators from the UNESCO Institute for Statistics Data API.',
    'active',
    40,
    jsonb_build_object(
      'dataset', 'UIS Data Browser',
      'workflow', 'import-unesco.yml',
      'api', 'https://api.uis.unesco.org/api/public',
      'documentation', 'https://databrowser.uis.unesco.org/resources',
      'intake_policy', 'geostats-v13.1-strict',
      'review_required', true,
      'canonical_layer', true
    )
  ),
  (
    'ilostat',
    'ILOSTAT',
    'Curated internationally harmonized labor-market, working-conditions, productivity, and social-protection indicators.',
    'active',
    80,
    jsonb_build_object(
      'dataset', 'ILOSTAT bulk download',
      'workflow', 'import-ilostat.yml',
      'api', 'https://rplumber.ilo.org',
      'documentation', 'https://ilostat.ilo.org/data/bulk/',
      'intake_policy', 'geostats-v13.1-strict',
      'review_required', true,
      'canonical_layer', true
    )
  ),
  (
    'climate',
    'Natural Earth geography',
    'Stable country-geography categories derived consistently from Natural Earth 1:10m country geometries.',
    'active',
    90,
    jsonb_build_object(
      'dataset', 'Natural Earth Admin 0 Countries 1:10m v5.1.1',
      'workflow', 'import-natural-earth.yml',
      'download', 'https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries.zip',
      'documentation', 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/',
      'intake_policy', 'geostats-v13.1-strict',
      'review_required', true,
      'canonical_layer', true,
      'static_geography', true,
      'boundary_model', 'de facto'
    )
  )
on conflict(id) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  display_order = excluded.display_order,
  metadata = coalesce(public.data_sources.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = now();

commit;
