-- GeoStats: allow either an exact indicator page or a human-readable general official source page.

alter table public.stat_categories drop constraint if exists stat_categories_player_source_status_check;
alter table public.stat_categories add constraint stat_categories_player_source_status_check
  check (player_source_status in ('pending','exact','general','needs_exact_url','invalid','unavailable'));

-- Fill approved categories with a human-readable fallback when no exact page exists.
update public.stat_categories
set
  player_source_url = coalesce(
    case when source_page_url ~* '^https://' and source_page_url !~* '(\\.(csv|tsv|json|xml|zip|gz|xlsx?|parquet)([?#]|$)|/api/|/download|[?&](format|download|output|type)=)' then source_page_url end,
    case when source_url ~* '^https://' and source_url !~* '(\\.(csv|tsv|json|xml|zip|gz|xlsx?|parquet)([?#]|$)|/api/|/download|[?&](format|download|output|type)=)' then source_url end,
    case when methodology_url ~* '^https://' and methodology_url !~* '(\\.(csv|tsv|json|xml|zip|gz|xlsx?|parquet)([?#]|$)|/api/|/download|[?&](format|download|output|type)=)' then methodology_url end
  ),
  player_source_status = 'general',
  player_source_reason = 'Human-readable official source landing page; an exact indicator page was not available.',
  link_quality_score = greatest(coalesce(link_quality_score, 0), 70)
where content_review_status = 'approved'
  and player_source_status <> 'exact'
  and coalesce(
    case when source_page_url ~* '^https://' and source_page_url !~* '(\\.(csv|tsv|json|xml|zip|gz|xlsx?|parquet)([?#]|$)|/api/|/download|[?&](format|download|output|type)=)' then source_page_url end,
    case when source_url ~* '^https://' and source_url !~* '(\\.(csv|tsv|json|xml|zip|gz|xlsx?|parquet)([?#]|$)|/api/|/download|[?&](format|download|output|type)=)' then source_url end,
    case when methodology_url ~* '^https://' and methodology_url !~* '(\\.(csv|tsv|json|xml|zip|gz|xlsx?|parquet)([?#]|$)|/api/|/download|[?&](format|download|output|type)=)' then methodology_url end
  ) is not null;

-- Replace the old exact-only trigger with an exact-or-general gate.
create or replace function public.enforce_stat_category_content_player_link_gate()
returns trigger
language plpgsql
as $$
begin
  if new.player_source_url is not null and new.player_source_url !~* '^https://' then
    new.player_source_status := 'invalid';
    new.player_source_reason := 'Player source links must use HTTPS.';
    new.link_quality_score := 0;
  end if;

  if new.content_review_status <> 'approved'
     or new.player_source_status not in ('exact','general')
     or new.player_source_url is null
     or coalesce(new.immediate_comprehension_score,0) < 80
     or coalesce(new.gameplay_interest_score,0) < 65 then
    new.eligible_daily := false;
  end if;
  return new;
end;
$$;

-- Restore daily eligibility for categories that pass every non-link gate and have either link tier.
update public.stat_categories
set eligible_daily = true
where enabled = true
  and review_status = 'approved'
  and curation_status = 'approved'
  and validation_status = 'verified'
  and content_review_status = 'approved'
  and player_source_status in ('exact','general')
  and player_source_url is not null
  and coalesce(immediate_comprehension_score,0) >= 80
  and coalesce(gameplay_interest_score,0) >= 65
  and coalesce(credibility_score,100) >= 75
  and coalesce(objective_status,'objective') = 'objective'
  and coalesce(player_quality_status,'approved') <> 'blocked'
  and coalesce(verifiability_score,100) >= 80
  and coalesce(understandability_score,100) >= 70
  and coalesce(fun_score,100) >= 55;
