begin;

-- v16.2.7 durable exclusions must survive future importer upserts. Keep these
-- product decisions in provenance *and* at the table boundary so a source refresh
-- cannot silently turn an excluded category back on.
create or replace function public.refresh_category_decision_provenance_v16_2_7()
returns void language plpgsql security definer set search_path=public as $$
begin
  delete from public.category_decision_provenance_v16_2_7 where category_id is not null;
  insert into public.category_decision_provenance_v16_2_7(category_id,decision_class,durable,origin,reason,assessed_at)
  select c.id,
    case
      when r.status='duplicate' or r.duplicate_of is not null then 'duplicate_exclusion'
      when c.id in (
        'unescoheritage:all-sites',
        'comtrade:most-sports-equipment-exported',
        'worldbank-catalog:er-ptd-totl-zs'
      ) then 'durable_manual_exclusion'
      when c.id <> 'history:ipu-universal-womens-suffrage'
        and lower(c.title) ~ '(^|[^a-z])(female|woman|women)([^a-z]|$)' then 'durable_manual_exclusion'
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove')
        or lower(c.title) ~ '(yield|harvested area)' then 'durable_manual_exclusion'
      when r.status='rejected' and (
        coalesce(c.curation_reason,'') ilike 'v16.2.3: superseded%'
        or coalesce(c.curation_reason,'') ilike '%intentionally excluded because%'
        or coalesce(c.curation_reason,'') ilike 'Curated out:%'
        or coalesce(c.content_review_reason,'') ilike '%intentionally excluded because%'
      ) then 'current_editorial_exclusion'
      when r.status='rejected' then 'legacy_generic_exclusion'
      when r.status='needs_rewrite' or c.content_review_status='pending' and coalesce(c.curation_status,'pending')<>'approved' then 'pending_copy_rewrite'
      when c.validation_status in ('failed','pending','unable_to_verify') then 'pending_source_repair'
      when r.status='approved' then 'approved_current'
      else 'pending_editorial'
    end,
    case
      when r.status='duplicate' or r.duplicate_of is not null then true
      when c.id in (
        'unescoheritage:all-sites',
        'comtrade:most-sports-equipment-exported',
        'worldbank-catalog:er-ptd-totl-zs'
      ) then true
      when c.id <> 'history:ipu-universal-womens-suffrage'
        and lower(c.title) ~ '(^|[^a-z])(female|woman|women)([^a-z]|$)' then true
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove') then true
      when lower(c.title) ~ '(yield|harvested area)' then true
      when r.status='rejected' and (
        coalesce(c.curation_reason,'') ilike 'v16.2.3: superseded%'
        or coalesce(c.curation_reason,'') ilike '%intentionally excluded because%'
        or coalesce(c.curation_reason,'') ilike 'Curated out:%'
        or coalesce(c.content_review_reason,'') ilike '%intentionally excluded because%'
      ) then true
      else false
    end,
    case
      when c.id in (
        'unescoheritage:all-sites',
        'comtrade:most-sports-equipment-exported',
        'worldbank-catalog:er-ptd-totl-zs'
      ) then 'v16.2.7 durable product rule'
      when c.id <> 'history:ipu-universal-womens-suffrage'
        and lower(c.title) ~ '(^|[^a-z])(female|woman|women)([^a-z]|$)' then 'v16.2.7 durable women-category rule'
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove') then 'v16.2.6 explicit decision table'
      when lower(c.title) ~ '(yield|harvested area)' then 'durable product rule'
      when r.status='rejected' then 'historical editorial state'
      else 'current catalog state'
    end,
    case
      when c.id='unescoheritage:all-sites' then 'GeoStats product decision: UNESCO World Heritage categories remain excluded.'
      when c.id='comtrade:most-sports-equipment-exported' then 'GeoStats product decision: sports-equipment exports is too niche/contrived for play.'
      when c.id='worldbank-catalog:er-ptd-totl-zs' then 'GeoStats product decision: combined land-and-sea protected-share framing is ambiguous and overlaps clearer concepts.'
      when c.id <> 'history:ipu-universal-womens-suffrage'
        and lower(c.title) ~ '(^|[^a-z])(female|woman|women)([^a-z]|$)' then 'GeoStats product decision: exclude female/women variants except Earliest universal women’s suffrage.'
      when exists(select 1 from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove')
        then coalesce((select d.reason from public.category_decisions_v16_2_6 d where d.source_indicator_code=c.source_indicator_code and d.action='remove' limit 1),'Explicit removal.')
      when lower(c.title) ~ '(yield|harvested area)' then 'Deliberately preserve the GeoStats anti-proliferation exclusion for crop/commodity yield and harvested-area variants.'
      when r.status='rejected' and coalesce(c.content_review_reason,'') ilike '%authoritative category review state: rejected%'
        then 'Inherited generic rejection; re-audit from current source/player evidence rather than treating the old label as permanent.'
      else coalesce(nullif(c.curation_reason,''),nullif(c.content_review_reason,''),nullif(r.notes,''),'Current catalog state.')
    end,
    now()
  from public.stat_categories c
  join public.category_review_state r on r.category_id=c.id;
end;
$$;

create or replace function public.enforce_v16_2_7_category_product_exclusions()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.id in (
      'unescoheritage:all-sites',
      'comtrade:most-sports-equipment-exported',
      'worldbank-catalog:er-ptd-totl-zs'
    )
    or (
      new.id <> 'history:ipu-universal-womens-suffrage'
      and lower(coalesce(new.title,'')) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)'
    )
  then
    new.enabled := false;
    new.eligible_daily := false;
    new.review_status := 'rejected';
    new.curation_status := 'excluded';
    new.content_review_status := 'excluded';
    if new.id='unescoheritage:all-sites' then
      new.curation_reason := 'v16.2.7 durable product decision: UNESCO World Heritage categories remain excluded.';
    elsif new.id='comtrade:most-sports-equipment-exported' then
      new.curation_reason := 'v16.2.7 durable product decision: sports-equipment exports is too niche/contrived for play.';
    elsif new.id='worldbank-catalog:er-ptd-totl-zs' then
      new.curation_reason := 'v16.2.7 durable product decision: combined land-and-sea protected-share framing remains excluded.';
    else
      new.curation_reason := 'v16.2.7 durable product decision: female/women variants remain excluded except Earliest universal women’s suffrage.';
    end if;
    new.content_review_reason := new.curation_reason;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_v16_2_7_category_product_exclusions on public.stat_categories;
create trigger trg_enforce_v16_2_7_category_product_exclusions
before insert or update on public.stat_categories
for each row execute function public.enforce_v16_2_7_category_product_exclusions();

create or replace function public.enforce_v16_2_7_review_product_exclusions()
returns trigger language plpgsql set search_path=public as $$
declare c_title text;
begin
  select title into c_title from public.stat_categories where id=new.category_id;
  if new.category_id in (
      'unescoheritage:all-sites',
      'comtrade:most-sports-equipment-exported',
      'worldbank-catalog:er-ptd-totl-zs'
    )
    or (
      new.category_id <> 'history:ipu-universal-womens-suffrage'
      and lower(coalesce(c_title,'')) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)'
    )
  then
    new.status := 'rejected';
    new.duplicate_of := null;
    if new.category_id='unescoheritage:all-sites' then
      new.notes := 'v16.2.7 durable product decision: UNESCO World Heritage categories remain excluded.';
    elsif new.category_id='comtrade:most-sports-equipment-exported' then
      new.notes := 'v16.2.7 durable product decision: sports-equipment exports is too niche/contrived for play.';
    elsif new.category_id='worldbank-catalog:er-ptd-totl-zs' then
      new.notes := 'v16.2.7 durable product decision: combined land-and-sea protected-share framing remains excluded.';
    else
      new.notes := 'v16.2.7 durable product decision: female/women variants remain excluded except Earliest universal women’s suffrage.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_v16_2_7_review_product_exclusions on public.category_review_state;
create trigger trg_enforce_v16_2_7_review_product_exclusions
before insert or update on public.category_review_state
for each row execute function public.enforce_v16_2_7_review_product_exclusions();

-- Touch existing ruled-out rows so the BEFORE UPDATE triggers normalize their
-- current state immediately as well as all future importer writes.
update public.stat_categories set updated_at=now()
where id in (
  'unescoheritage:all-sites',
  'comtrade:most-sports-equipment-exported',
  'worldbank-catalog:er-ptd-totl-zs'
) or (
  id <> 'history:ipu-universal-womens-suffrage'
  and lower(coalesce(title,'')) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)'
);

update public.category_review_state set updated_at=now()
where category_id in (
  'unescoheritage:all-sites',
  'comtrade:most-sports-equipment-exported',
  'worldbank-catalog:er-ptd-totl-zs'
) or category_id in (
  select id from public.stat_categories
  where id <> 'history:ipu-universal-womens-suffrage'
    and lower(coalesce(title,'')) ~ '(^|[^a-z])(women|woman|female)([^a-z]|$)'
);

select public.refresh_category_decision_provenance_v16_2_7();

commit;
