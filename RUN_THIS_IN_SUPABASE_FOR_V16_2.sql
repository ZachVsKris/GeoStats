-- GeoStats v16.2: conservative catalog recovery, source-specific playability,
-- actionable blocker classification, and one shared playable catalog for Daily
-- and Random. Run after v16.1. Safe to rerun.

begin;

select pg_advisory_xact_lock(hashtext('geostats-v16.2-catalog-recovery'));

do $$
begin
  if to_regclass('public.category_runtime_review_v16') is null then
    raise exception 'GeoStats v16.1 is required before v16.2.';
  end if;
  if to_regclass('public.category_semantic_audit_v16_1') is null then
    raise exception 'The v16.1 semantic audit is required before v16.2.';
  end if;
end $$;

create table if not exists public.v16_2_category_backup (
  category_id text primary key,
  category_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v16_2_category_backup(category_id,category_state)
select id,to_jsonb(c) from public.stat_categories c
on conflict(category_id) do nothing;

create table if not exists public.v16_2_review_backup (
  category_id text primary key,
  review_state jsonb not null,
  captured_at timestamptz not null default now()
);
insert into public.v16_2_review_backup(category_id,review_state)
select category_id,to_jsonb(r) from public.category_review_state r
on conflict(category_id) do nothing;


create or replace function public.replace_stat_category_observations_v16_2(
  p_category_id text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path=public
set statement_timeout='90s'
as $$
declare
  inserted_count integer;
begin
  if p_category_id is null or p_category_id='' then
    raise exception 'category id is required';
  end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then
    raise exception 'observation rows must be a JSON array';
  end if;

  delete from public.stat_observations where category_id=p_category_id;
  insert into public.stat_observations(
    category_id,country_iso3,country_name,data_year,value,
    source_url,source_record_id,metadata
  )
  select
    p_category_id,r.country_iso3,r.country_name,r.data_year,r.value,
    r.source_url,r.source_record_id,coalesce(r.metadata,'{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as r(
    country_iso3 text,country_name text,data_year integer,value numeric,
    source_url text,source_record_id text,metadata jsonb
  )
  where r.country_iso3 is not null and r.data_year is not null and r.value is not null;
  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;
revoke all on function public.replace_stat_category_observations_v16_2(text,jsonb) from public,anon,authenticated;
grant execute on function public.replace_stat_category_observations_v16_2(text,jsonb) to service_role;

create table if not exists public.category_auto_promotion_events_v16_2 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  previous_status text not null,
  promoted_status text not null,
  reason text not null,
  promotion_version text not null default 'geostats-v16.2-conservative-promotion-v1',
  promoted_at timestamptz not null default now()
);
alter table public.category_auto_promotion_events_v16_2 enable row level security;
revoke all on public.category_auto_promotion_events_v16_2 from public,anon,authenticated;
grant all on public.category_auto_promotion_events_v16_2 to service_role;

create table if not exists public.category_promotion_assessment_v16_2 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  current_editorial_status text not null,
  proposed_status text not null check(proposed_status in (
    'playable','auto_promote','manual_review','rewrite_required',
    'data_repair_required','duplicate','excluded'
  )),
  blocker_class text not null,
  primary_blocker text,
  reason text not null,
  strict_pass boolean not null default false,
  source_quality_floor integer not null,
  suggested_duplicate_of text,
  assessment_version text not null default 'geostats-v16.2-conservative-promotion-v1',
  assessed_at timestamptz not null default now()
);
create index if not exists category_promotion_assessment_v16_2_status_idx
  on public.category_promotion_assessment_v16_2(proposed_status,blocker_class);
alter table public.category_promotion_assessment_v16_2
  add column if not exists suggested_duplicate_of text;
alter table public.category_promotion_assessment_v16_2 enable row level security;
revoke all on public.category_promotion_assessment_v16_2 from public,anon,authenticated;
grant select on public.category_promotion_assessment_v16_2 to service_role;

create or replace function public.category_v16_2_quality_floor(p_source text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_source,''))
    when 'natural earth' then 55
    when 'pew research center' then 55
    when 'smithsonian gvp' then 60
    when 'usgs' then 60
    when 'faostat food balances' then 65
    when 'unhcr' then 65
    when 'who' then 65
    else 70
  end
$$;

create or replace function public.category_v16_2_copy_is_clear(
  p_title text,
  p_description text,
  p_unit text,
  p_indicator text
)
returns boolean
language sql
immutable
as $$
  select
    char_length(trim(coalesce(p_title,''))) between 3 and 82
    and char_length(trim(coalesce(p_description,''))) between 8 and 360
    and lower(coalesce(p_title,'')) !~ '(compare countries|official country value|indicator [0-9]|series [a-z0-9])'
    and lower(coalesce(p_title,'')||' '||coalesce(p_description,'')) !~
      '(happiness|corruption perception|freedom index|democracy index|government effectiveness|political stability|self.?reported satisfaction)'
    and not (
      lower(coalesce(p_unit,'')) ~ '(percent|%)'
      and lower(coalesce(p_title,'')) !~ '(share|percent|percentage|rate|access|coverage|prevalence|population aged|population under|population over|vaccination)'
      and lower(coalesce(p_indicator,'')) !~ '(\.zs$|\.p2$|rate|prop|share|pct|percent)'
    )
$$;

create or replace function public.apply_v16_2_copy_corrections()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.stat_categories
  set title='Highest share of land protected',
      short_title='Land protected',
      description='Percentage of a country''s land area that is protected.',
      updated_at=now()
  where source_indicator_code='ER.LND.PTLD.ZS'
     or title='Most land protected';

  update public.stat_categories
  set title='Highest share of land that is arable',
      short_title='Arable land share',
      description='Percentage of a country''s land area classified as arable land.',
      updated_at=now()
  where source_indicator_code='AG.LND.ARBL.ZS';

  update public.stat_categories
  set title='Largest arable land area',
      short_title='Arable land area',
      description='Total area of arable land in each country.',
      updated_at=now()
  where source_indicator_code='AG.LND.ARBL.K2';

  update public.stat_categories
  set title='Highest fixed broadband subscriptions per 100 people',
      short_title='Fixed broadband subscriptions',
      description='Fixed broadband subscriptions per 100 people.',
      updated_at=now()
  where source_indicator_code='IT.NET.BBND.P2';

  update public.stat_categories
  set title='Highest secure Internet servers per million people',
      short_title='Secure Internet servers',
      description='Secure Internet servers per one million people.',
      updated_at=now()
  where source_indicator_code in ('IT.NET.SECR.P6','IT.NET.SECR.P6.WDI');

  update public.category_review_state r
  set recommended_title=c.title,updated_at=now()
  from public.stat_categories c
  where c.id=r.category_id
    and c.source_indicator_code in (
      'ER.LND.PTLD.ZS','AG.LND.ARBL.ZS','AG.LND.ARBL.K2',
      'IT.NET.BBND.P2','IT.NET.SECR.P6','IT.NET.SECR.P6.WDI'
    );
end;
$$;
revoke all on function public.apply_v16_2_copy_corrections() from public,anon,authenticated;
grant execute on function public.apply_v16_2_copy_corrections() to service_role;

create or replace function public.refresh_category_promotion_assessment_v16_2()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  delete from public.category_promotion_assessment_v16_2 where category_id is not null;

  insert into public.category_promotion_assessment_v16_2(
    category_id,current_editorial_status,proposed_status,blocker_class,
    primary_blocker,reason,strict_pass,source_quality_floor,suggested_duplicate_of,assessed_at
  )
  with base as (
    select
      v.*,
      public.category_v16_2_quality_floor(v.source_organization) as source_floor,
      public.category_v15_true_integrity_failure(
        v.validation_status,v.validation_reason,
        v.validation_mismatch_count,v.validation_ranking_mismatch_count
      ) as true_integrity_failure,
      public.category_v16_2_copy_is_clear(
        v.effective_title,coalesce(v.plain_language_description,v.description),
        v.unit,v.source_indicator_code
      ) as copy_clear,
      case
        when nullif(trim(coalesce(v.source_indicator_code,'')),'') is not null then
          'series|'||lower(coalesce(v.source_organization,''))||'|'||lower(v.source_indicator_code)||'|'||coalesce(v.ranking_direction,'high')
        else
          'title|'||regexp_replace(lower(coalesce(v.effective_title,'')),'[^a-z0-9]+','','g')||'|'||lower(coalesce(v.unit,''))||'|'||coalesce(v.ranking_direction,'high')
      end as exact_duplicate_key,
      (
        v.semantic_audit_status='pass'
        and v.ranking_completeness_status in ('comprehensive','top_end_complete')
        and coalesce(v.top_value_feasible,false)
        and not public.category_v15_true_integrity_failure(
          v.validation_status,v.validation_reason,
          v.validation_mismatch_count,v.validation_ranking_mismatch_count
        )
        and (
          v.validation_status='verified'
          or (
            v.validation_status='unable_to_verify'
            and coalesce(v.validation_reason,'') ilike 'Non-blocking audit warning:%'
          )
        )
        and coalesce(v.quality_score,0)>=public.category_v16_2_quality_floor(v.source_organization)
        and coalesce(v.credibility_status,'approved')<>'quarantined'
        and coalesce(v.credibility_score,75)>=70
        and greatest(coalesce(v.common_year_coverage,0),coalesce(v.country_coverage,0))>=30
        and not coalesce(v.stale_data,false)
        and v.player_source_status in ('exact','general')
        and public.player_source_url_is_safe(v.player_source_url)
        and coalesce(v.objective_status,'objective')='objective'
        and coalesce(v.player_quality_status,'approved')<>'blocked'
        and coalesce(v.content_review_status,'pending')<>'excluded'
        and coalesce(v.curation_status,'pending')<>'excluded'
        and (
          v.content_review_status='approved'
          or (
            coalesce(v.immediate_comprehension_score,0)>=85
            and coalesce(v.gameplay_interest_score,0)>=70
            and coalesce(v.uniqueness_score,0)>=65
          )
        )
        and public.category_v16_2_copy_is_clear(
          v.effective_title,coalesce(v.plain_language_description,v.description),
          v.unit,v.source_indicator_code
        )
        and not coalesce(v.political_self_reported,false)
        and not coalesce(v.confusing,false)
        and not coalesce(v.esoteric,false)
        and not coalesce(v.subjective_or_composite,false)
        and not coalesce(v.poor_coverage,false)
        and v.duplicate_of is null
        and lower(v.source_organization) not in ('unesco uis','u.s. eia')
        and lower(coalesce(v.effective_title,'')) !~ '(yield|harvested area|carcass|slaughter|producing animals|output per worker|employment.?to.?population|labor.?income share)'
      ) as strict_pass
    from public.category_runtime_review_v16 v
  ), ranked as (
    select b.*,
      count(*) over(partition by exact_duplicate_key) as exact_duplicate_count,
      first_value(id) over(
        partition by exact_duplicate_key
        order by
          case when editorial_status='approved' then 0 else 1 end,
          case when validation_status='verified' then 0 else 1 end,
          coalesce(quality_score,0) desc,
          id
      ) as preferred_exact_duplicate_id
    from base b
  ), assessed as (
    select r.*,case
      when exact_duplicate_count>1 and id<>preferred_exact_duplicate_id then preferred_exact_duplicate_id
      else null
    end as detected_duplicate_of
    from ranked r
  )
  select
    id,
    editorial_status,
    case
      when editorial_status='duplicate' or duplicate_of is not null or detected_duplicate_of is not null then 'duplicate'
      when editorial_status='rejected' then 'excluded'
      when semantic_audit_status='data_repair_required' or true_integrity_failure then 'data_repair_required'
      when semantic_audit_status='rewrite_required' or not copy_clear then 'rewrite_required'
      when strict_pass and editorial_status='approved' then 'playable'
      when strict_pass and editorial_status in ('pending','needs_rewrite') then 'auto_promote'
      else 'manual_review'
    end,
    case
      when editorial_status='duplicate' or duplicate_of is not null or detected_duplicate_of is not null then 'duplicate'
      when editorial_status='rejected' then 'editorial_exclusion'
      when semantic_audit_status='data_repair_required' or true_integrity_failure then 'substantive_data_failure'
      when semantic_audit_status='rewrite_required' or not copy_clear then 'copy_or_semantic_rewrite'
      when strict_pass and editorial_status in ('approved','pending','needs_rewrite') then 'strict_automatic_pass'
      when validation_status not in ('verified','unable_to_verify')
        or (validation_status='unable_to_verify' and coalesce(validation_reason,'') not ilike 'Non-blocking audit warning:%')
        then 'source_audit_pending'
      when semantic_audit_status<>'pass' then 'semantic_review'
      when ranking_completeness_status not in ('comprehensive','top_end_complete') or not coalesce(top_value_feasible,false) then 'ranking_completeness'
      when coalesce(quality_score,0)<source_floor then 'source_specific_quality'
      when content_review_status<>'approved' then 'editorial_content_review'
      else 'manual_editorial_review'
    end,
    case
      when detected_duplicate_of is not null then 'Exact duplicate of preferred category '||detected_duplicate_of||'.'
      when editorial_status='duplicate' or duplicate_of is not null then 'Marked as a duplicate of another category.'
      when editorial_status='rejected' then 'Deliberately excluded by editorial policy.'
      when semantic_audit_status='data_repair_required' then 'Semantic audit identified a substantive data repair.'
      when true_integrity_failure then coalesce(validation_reason,'Official-source values or rankings do not match the stored data.')
      when semantic_audit_status='rewrite_required' or not copy_clear then 'Player-facing title, description, or unit needs a clearer rewrite.'
      when strict_pass and editorial_status='approved' then null
      when strict_pass then null
      when validation_status not in ('verified','unable_to_verify') then 'Official-source value and ranking audit has not completed.'
      when validation_status='unable_to_verify' and coalesce(validation_reason,'') not ilike 'Non-blocking audit warning:%' then coalesce(validation_reason,'Official-source audit could not verify this category.')
      when semantic_audit_status<>'pass' then 'Semantic audit has not passed.'
      when ranking_completeness_status not in ('comprehensive','top_end_complete') then coalesce(ranking_completeness_reason,'Ranking completeness has not passed.')
      when not coalesce(top_value_feasible,false) then 'The meaningful top values are not distinct enough for a GeoStats board.'
      when coalesce(quality_score,0)<source_floor then 'Below the source-specific quality floor.'
      when greatest(coalesce(common_year_coverage,0),coalesce(country_coverage,0))<30 then 'Fewer than 30 comparable country values are available.'
      when coalesce(objective_status,'objective')<>'objective' then 'The measure is not classified as objective.'
      when coalesce(player_quality_status,'approved')='blocked' then coalesce(player_quality_reason,'Player-quality review blocked the category.')
      when content_review_status<>'approved' then coalesce(content_review_reason,'Content review is not approved and automatic clarity scores are insufficient.')
      else 'Requires a human editorial decision.'
    end,
    case
      when detected_duplicate_of is not null then 'Keep blocked as an exact duplicate of preferred category '||detected_duplicate_of||'.'
      when editorial_status='duplicate' or duplicate_of is not null then 'Keep blocked as a duplicate of the preferred category.'
      when strict_pass and editorial_status='approved' then 'Already approved and passes the v16.2 source-specific, semantic, ranking, clarity, and board-feasibility gates.'
      when strict_pass then 'Auto-approve: objective official-source measure; semantic identity, bounds, rankings, coverage, clarity, and board feasibility all pass.'
      when semantic_audit_status='data_repair_required' or true_integrity_failure then 'Keep blocked until source values, dimensions, year, coverage, or rankings are repaired and re-audited.'
      when semantic_audit_status='rewrite_required' or not copy_clear then 'Keep blocked until player-facing copy accurately distinguishes totals, shares, rates, per-person measures, residence, and origin.'
      else 'Do not auto-approve; retain for focused manual review.'
    end,
    strict_pass and detected_duplicate_of is null,
    source_floor,
    detected_duplicate_of,
    now()
  from assessed;
end;
$$;
revoke all on function public.refresh_category_promotion_assessment_v16_2() from public,anon,authenticated;
grant execute on function public.refresh_category_promotion_assessment_v16_2() to service_role;

create or replace function public.apply_conservative_promotions_v16_2()
returns table(promoted integer,already_playable integer,manual_review integer,data_repairs integer,rewrites integer)
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
declare
  promoted_count integer;
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  insert into public.category_auto_promotion_events_v16_2(
    category_id,previous_status,promoted_status,reason,promoted_at
  )
  select a.category_id,a.current_editorial_status,'approved',a.reason,now()
  from public.category_promotion_assessment_v16_2 a
  where a.proposed_status='auto_promote'
  on conflict(category_id) do nothing;

  update public.category_review_state r
  set status='approved',
      political_self_reported=false,
      confusing=false,
      esoteric=false,
      subjective_or_composite=false,
      stale_data=false,
      poor_coverage=false,
      duplicate_of=null,
      notes=concat_ws(E'\n',nullif(r.notes,''),a.reason),
      reviewed_at=coalesce(r.reviewed_at,now()),
      updated_at=now()
  from public.category_promotion_assessment_v16_2 a
  where a.category_id=r.category_id
    and a.proposed_status='auto_promote'
    and r.status in ('pending','needs_rewrite','needs_discussion');
  get diagnostics promoted_count = row_count;

  update public.stat_categories c
  set review_status='approved',
      curation_status='approved',
      content_review_status=case
        when c.content_review_status='excluded' then c.content_review_status
        else 'approved'
      end,
      content_review_reason=case
        when c.content_review_status='excluded' then c.content_review_reason
        else 'Conservative v16.2 automatic promotion: semantic, source, ranking, clarity, and board-feasibility checks passed.'
      end,
      metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
        'autoPromotedV16_2',true,
        'autoPromotionVersion','geostats-v16.2-conservative-promotion-v1'
      ),
      updated_at=now()
  from public.category_promotion_assessment_v16_2 a
  where a.category_id=c.id and a.proposed_status='auto_promote'
    and coalesce(c.content_review_status,'pending')<>'excluded'
    and coalesce(c.curation_status,'pending')<>'excluded';

  perform public.reconcile_category_playability_v15();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  return query
  select
    promoted_count,
    count(*) filter(where proposed_status='playable')::integer,
    count(*) filter(where proposed_status='manual_review')::integer,
    count(*) filter(where proposed_status='data_repair_required')::integer,
    count(*) filter(where proposed_status='rewrite_required')::integer
  from public.category_promotion_assessment_v16_2;
end;
$$;
revoke all on function public.apply_conservative_promotions_v16_2() from public,anon,authenticated;
grant execute on function public.apply_conservative_promotions_v16_2() to service_role;

-- Installation is deliberately dry-run only. Source recovery and independent
-- audits run before the workflow finalizer applies any automatic promotions.
select public.refresh_category_promotion_assessment_v16_2();

create or replace view public.category_runtime_review_v16_2
with(security_invoker=true) as
select
  v.*,
  a.proposed_status as promotion_decision_v16_2,
  a.reason as promotion_reason_v16_2,
  a.primary_blocker as primary_blocker_v16_2,
  a.blocker_class as blocker_class_v16_2,
  a.strict_pass as strict_pass_v16_2,
  a.source_quality_floor as source_quality_floor_v16_2,
  a.suggested_duplicate_of as suggested_duplicate_of_v16_2,
  (
    a.proposed_status='playable'
    and v.editorial_status='approved'
    and a.strict_pass
  ) as computed_playable_v16_2,
  array_remove(array[
    case when a.proposed_status<>'playable' then a.primary_blocker end
  ],null) as v16_2_blockers,
  array_remove(array[
    case when v.validation_status<>'verified'
      and not public.category_v15_true_integrity_failure(
        v.validation_status,v.validation_reason,
        v.validation_mismatch_count,v.validation_ranking_mismatch_count
      ) then 'Official values are usable; non-data source metadata remain incomplete.' end,
    case when v.ranking_completeness_status='top_end_complete' then 'Ranking is top-end complete rather than fully comprehensive.' end,
    case when v.player_source_status='general' then 'Uses a general official source page rather than an exact shareable view.' end
  ],null) as v16_2_warnings
from public.category_runtime_review_v16 v
join public.category_promotion_assessment_v16_2 a on a.category_id=v.id;
revoke all on public.category_runtime_review_v16_2 from public,anon,authenticated;
grant select on public.category_runtime_review_v16_2 to service_role;

create or replace view public.category_review_workbench_v16_2
with(security_invoker=true) as
select runtime.*,
 vetting.recommendation as auto_vetting_recommendation,
 vetting.vetting_score as auto_vetting_score,
 vetting.reason as auto_vetting_reason,
 vetting.possible_duplicate_of as auto_possible_duplicate_of,
 vetting.title_similarity as auto_title_similarity,
 vetting.rank_correlation as auto_rank_correlation,
 vetting.tie_share as auto_tie_share,
 vetting.vetting_version as auto_vetting_version,
 vetting.vetted_at as auto_vetted_at
from public.category_runtime_review_v16_2 runtime
left join public.category_auto_vetting_v15_9 vetting on vetting.category_id=runtime.id;
revoke all on public.category_review_workbench_v16_2 from public,anon,authenticated;
grant select on public.category_review_workbench_v16_2 to service_role;

create or replace view public.category_promotion_dry_run_v16_2
with(security_invoker=true) as
select
  v.id,v.effective_title as player_title,v.description,v.unit,
  v.source_organization,v.source_dataset,v.source_indicator_code,
  v.common_year,greatest(coalesce(v.common_year_coverage,0),coalesce(v.country_coverage,0)) as coverage,
  v.semantic_top_values as top_values,v.semantic_bottom_values as bottom_values,
  v.editorial_status as current_status,a.proposed_status,a.blocker_class,
  a.primary_blocker,a.reason,a.strict_pass,a.source_quality_floor,a.suggested_duplicate_of,
  v.semantic_audit_status,v.validation_status,v.validation_reason,
  v.ranking_completeness_status,v.ranking_completeness_reason,
  v.top_value_distinct_count,v.top_value_feasible
from public.category_runtime_review_v16 v
join public.category_promotion_assessment_v16_2 a on a.category_id=v.id
order by
  case a.proposed_status
    when 'auto_promote' then 1 when 'playable' then 2 when 'manual_review' then 3
    when 'rewrite_required' then 4 when 'data_repair_required' then 5
    when 'duplicate' then 6 else 7 end,
  v.source_organization,v.effective_title;
revoke all on public.category_promotion_dry_run_v16_2 from public,anon,authenticated;
grant select on public.category_promotion_dry_run_v16_2 to service_role;

create or replace view public.category_review_overview_v16_2
with(security_invoker=true) as
select
  count(*)::bigint as categories,
  count(*) filter(where editorial_status='pending')::bigint as pending,
  count(*) filter(where editorial_status='approved')::bigint as approved,
  count(*) filter(where editorial_status='rejected')::bigint as rejected,
  count(*) filter(where editorial_status='duplicate')::bigint as duplicates,
  count(*) filter(where editorial_status='needs_rewrite')::bigint as needs_rewrite,
  count(*) filter(where editorial_status='needs_discussion')::bigint as needs_discussion,
  count(*) filter(where hard_gate_ready)::bigint as hard_gate_ready,
  count(*) filter(where computed_playable_v16_2)::bigint as playable,
  count(*) filter(where promotion_decision_v16_2='manual_review')::bigint as manual_review,
  count(*) filter(where promotion_decision_v16_2='rewrite_required')::bigint as rewrite_required,
  count(*) filter(where promotion_decision_v16_2='data_repair_required')::bigint as data_repair_required,
  count(*) filter(where promotion_decision_v16_2='excluded')::bigint as excluded,
  count(*) filter(where editorial_status='pending')::bigint as pending_editorial,
  count(*) filter(where editorial_status='approved' and not computed_playable_v16_2)::bigint as approved_but_blocked,
  count(*) filter(where political_self_reported)::bigint as political_self_reported,
  count(*) filter(where confusing or esoteric)::bigint as confusing_or_esoteric,
  count(*) filter(where subjective_or_composite)::bigint as subjective_or_composite,
  count(*) filter(where semantic_audit_status='pass')::bigint as semantic_audit_passed,
  count(*) filter(where semantic_audit_status='rewrite_required')::bigint as semantic_rewrite_required,
  count(*) filter(where semantic_audit_status='data_repair_required')::bigint as semantic_data_repair_required,
  count(*) filter(where semantic_audit_status='review_required')::bigint as semantic_review_required,
  count(*)::bigint as assessed
from public.category_runtime_review_v16_2;
revoke all on public.category_review_overview_v16_2 from public,anon,authenticated;
grant select on public.category_review_overview_v16_2 to service_role;


create or replace view public.data_integrity_by_source_v16_2
with(security_invoker=true) as
select source_organization as source,count(*)::bigint categories,
 count(*) filter(where computed_playable_v16_2)::bigint playable,
 count(*) filter(where validation_status='verified')::bigint verified,
 count(*) filter(where validation_status<>'verified' and not public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint verified_with_warnings,
 count(*) filter(where public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint blocked,
 count(*) filter(where validation_status in ('pending','unable_to_verify'))::bigint audit_pending,
 max(validated_at) last_validated_at
from public.category_runtime_review_v16_2 group by source_organization;

create or replace view public.data_integrity_overview_v16_2
with(security_invoker=true) as
select true as enforcement_enabled,count(*)::bigint categories,
 count(*) filter(where computed_playable_v16_2)::bigint playable,
 count(*) filter(where validation_status='verified')::bigint verified,
 count(*) filter(where validation_status<>'verified' and not public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint verified_with_warnings,
 count(*) filter(where public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint blocked,
 count(*) filter(where validation_status in ('pending','unable_to_verify'))::bigint audit_pending,
 count(*) filter(where computed_playable_v16_2 and public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count))::bigint unverified_playable
from public.category_runtime_review_v16_2;

create or replace view public.data_integrity_issues_v16_2
with(security_invoker=true) as
select id,effective_title as title,source_organization,
 case when public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count)
   then 'blocked' when validation_status='verified' then 'verified' else 'verified_with_warnings' end as integrity_state,
 validation_status,validation_reason,validated_at,
 coalesce(validation_mismatch_count,0) as validation_mismatch_count,
 coalesce(validation_ranking_mismatch_count,0) as validation_ranking_mismatch_count,
 computed_playable_v16_2,primary_blocker_v16_2,v16_2_blockers,v16_2_warnings
from public.category_runtime_review_v16_2
where public.category_v15_true_integrity_failure(validation_status,validation_reason,validation_mismatch_count,validation_ranking_mismatch_count)
   or (computed_playable_v16_2 and validation_status<>'verified')
order by computed_playable_v16_2 desc,source_organization,effective_title;

grant select on public.data_integrity_by_source_v16_2,public.data_integrity_overview_v16_2,public.data_integrity_issues_v16_2 to service_role;

create or replace view public.category_catalog_consistency_v16_2
with(security_invoker=true) as
select
 count(*) filter(where enabled is distinct from eligible_daily)::bigint as daily_random_mismatches,
 count(*) filter(where enabled and not computed_playable_v16_2)::bigint as enabled_without_v16_2_pass,
 count(*) filter(where eligible_daily and not computed_playable_v16_2)::bigint as daily_without_v16_2_pass,
 count(*) filter(where computed_playable_v16_2)::bigint as playable
from public.category_runtime_review_v16_2;
revoke all on public.category_catalog_consistency_v16_2 from public,anon,authenticated;
grant select on public.category_catalog_consistency_v16_2 to service_role;

create or replace function public.refresh_v16_2_runtime_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='180s'
as $$
begin
  perform public.apply_v16_2_copy_corrections();
  perform public.refresh_category_ranking_completeness_v16();
  perform public.refresh_category_semantic_audit_v16_1();
  perform public.refresh_category_promotion_assessment_v16_2();

  update public.stat_categories c
  set enabled=v.computed_playable_v16_2,
      eligible_daily=v.computed_playable_v16_2,
      updated_at=now()
  from public.category_runtime_review_v16_2 v
  where v.id=c.id;
end;
$$;
revoke all on function public.refresh_v16_2_runtime_catalog() from public,anon,authenticated;
grant execute on function public.refresh_v16_2_runtime_catalog() to service_role;

create or replace function public.finalize_v16_2_catalog()
returns void
language plpgsql
security definer
set search_path=public
set statement_timeout='240s'
as $$
begin
  perform pg_advisory_xact_lock(hashtext('geostats-v16.2-finalize-catalog'));
  perform public.apply_v16_1_copy_corrections();
  perform public.apply_conservative_promotions_v16_2();
  perform public.refresh_v16_2_runtime_catalog();
end;
$$;
revoke all on function public.finalize_v16_2_catalog() from public,anon,authenticated;
grant execute on function public.finalize_v16_2_catalog() to service_role;

select public.refresh_v16_2_runtime_catalog();

notify pgrst,'reload schema';

commit;
