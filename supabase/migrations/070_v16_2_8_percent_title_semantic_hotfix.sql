begin;

-- v16.2.8 made percentage titles immediately readable by using an explicit "%".
-- The older semantic audit only recognized the words share/percent/percentage,
-- so it incorrectly marked twelve newly clarified rows rewrite_required. Patch
-- both title checks without changing any data, coverage, or integrity gate.
do $$
declare
  v_definition text;
  v_patched text;
  v_old_pattern constant text := '(share|percentage|percent|rate|prevalence|probability|growth|inflation|change)';
  v_new_pattern constant text := '(share|percentage|percent|%|rate|prevalence|probability|growth|inflation|change)';
begin
  select pg_get_functiondef('public.refresh_category_semantic_audit_v16_1()'::regprocedure)
  into v_definition;
  v_patched := replace(v_definition,v_old_pattern,v_new_pattern);
  if v_patched=v_definition then
    raise exception 'v16.2.8 percent-title hotfix could not find the semantic-audit pattern';
  end if;
  execute v_patched;
end $$;

do $$
declare
  v_definition text;
  v_patched text;
  v_old_pattern constant text := '(share|percent|percentage|rate|access|coverage|prevalence|population aged|population under|population over|vaccination)';
  v_new_pattern constant text := '(share|percent|percentage|%|rate|access|coverage|prevalence|population aged|population under|population over|vaccination)';
begin
  select pg_get_functiondef('public.category_v16_2_copy_is_clear(text,text,text,text)'::regprocedure)
  into v_definition;
  v_patched := replace(v_definition,v_old_pattern,v_new_pattern);
  if v_patched=v_definition then
    raise exception 'v16.2.8 percent-title hotfix could not find the copy-clarity pattern';
  end if;
  execute v_patched;
end $$;

select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

do $$
begin
  if exists (
    select 1
    from public.category_runtime_review_v16_2
    where enabled
      and eligible_daily
      and not computed_playable_v16_2
  ) then
    raise exception 'v16.2.8 retained categories are not all runtime-playable';
  end if;

  if exists (
    select 1
    from public.category_runtime_review_v16_2
    where enabled
      and eligible_daily
      and position('%' in title)>0
      and semantic_audit_status='rewrite_required'
  ) then
    raise exception 'v16.2.8 explicit percent titles still fail semantic review';
  end if;
end $$;

commit;
