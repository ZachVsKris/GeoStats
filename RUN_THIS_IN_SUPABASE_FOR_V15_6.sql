-- GeoStats v15.6 Catalog Reset + Real Expansion
-- Apply only after GitHub verification and Vercel deployment pass.

begin;

create table if not exists public.category_catalog_editorial_v15_6 (
  category_id text primary key references public.stat_categories(id) on delete cascade,
  original_title text not null,
  player_title text not null,
  player_description text,
  editorial_outcome text not null check (editorial_outcome in ('daily','random','rewrite','duplicate','retired','quarantined')),
  decision_reason text not null,
  preferred_category_id text,
  broad_domain text not null default 'other',
  knowledge_cluster text not null default 'other',
  strategy_family text not null default 'other',
  decision_source text not null default 'v15.6 catalog reset',
  reviewed_at timestamptz not null default now()
);

-- Seed from the current catalog, preserving source titles while creating explicit player copy.
insert into public.category_catalog_editorial_v15_6(category_id,original_title,player_title,player_description,editorial_outcome,decision_reason,broad_domain,knowledge_cluster,strategy_family)
select c.id,c.title,c.title,coalesce(c.plain_language_description,c.description),
       case when c.enabled and c.eligible_daily then 'daily' when c.enabled then 'random' else 'quarantined' end,
       'Awaiting v15.6 full editorial decision.',
       coalesce(c.metadata->>'broadDomain',lower(c.family),'other'),
       coalesce(c.metadata->>'knowledgeCluster',c.semantic_family,c.concept_group,lower(c.family),'other'),
       coalesce(c.metadata->>'strategyFamily',c.semantic_family,c.concept_group,lower(c.family),'other')
from public.stat_categories c
on conflict(category_id) do nothing;

-- Hard FAOSTAT production-only rule. Production Quantity elements 5510/5513 may remain candidates.
update public.category_catalog_editorial_v15_6 e
set editorial_outcome='retired',
    decision_reason='Retired by v15.6 production-only agriculture policy: yield, harvested area, stocks, producing animals, slaughter counts, carcass weight and efficiency measures are excluded.',
    reviewed_at=now()
from public.stat_categories c
where c.id=e.category_id and lower(coalesce(c.source_organization,'')) like '%fao%'
  and coalesce(c.source_indicator_code,c.indicator_code,'') ~* 'QCL:''?[^:]+:(5312|5412|5417|5111|5320|5513[0-9])';

-- Known contrived concepts. Match source codes and wording so alternate IDs cannot bypass policy.
update public.category_catalog_editorial_v15_6 e
set editorial_outcome='retired', decision_reason='Retired by v15.6 immediate-understanding review: the concept is contrived or cannot be simplified accurately.', reviewed_at=now()
from public.stat_categories c
where c.id=e.category_id and (
  coalesce(c.source_indicator_code,c.indicator_code,'') in ('FI.RES.TOTL.CD','SP.URB.TOTL','SP.RUR.TOTL')
  or c.title ~* '(total reserves.*(minus|excluding) gold|largest continuous land area|largest mapped land area|net errors and omissions|urban agglomerations of more than 1 million)'
);

-- Curated rewrites: retain strong concepts while replacing source jargon.
with rewrites(indicator_code, old_pattern, player_title, player_description) as (values
 ('CM.MKT.TRAD.CD','stocks traded','Most stock trading','Total value of shares traded during the year.'),
 ('SH.H2O.SMDW.ZS','safely managed drinking','Best access to safe drinking water','Share of people using safely managed drinking-water services.'),
 ('ER.LND.PTLD.ZS','protected-land','Most land protected','Share of national land area officially protected.'),
 (null,'STEM graduate','Most graduates in STEM','Share of tertiary graduates completing science, technology, engineering or mathematics programs.'),
 (null,'mapped river density','Highest river density','Total river length relative to land area.')
)
update public.category_catalog_editorial_v15_6 e
set player_title=r.player_title, player_description=r.player_description, editorial_outcome=case when e.editorial_outcome='retired' then 'retired' else 'rewrite' end,
    decision_reason='Retained with a deliberate v15.6 player-facing rewrite.', reviewed_at=now()
from public.stat_categories c, rewrites r
where c.id=e.category_id and ((r.indicator_code is not null and coalesce(c.source_indicator_code,c.indicator_code,'')=r.indicator_code) or c.title ilike '%'||r.old_pattern||'%');

-- Forced-displacement representatives: retain one origin and one destination concept in catalog, but only one across a Daily trio.
update public.category_catalog_editorial_v15_6 e
set editorial_outcome='duplicate', preferred_category_id=(select id from public.stat_categories where coalesce(source_indicator_code,indicator_code,'')='population:coo:refugees' limit 1),
    decision_reason='Duplicate origin-based displacement concept; Most refugees living abroad is the preferred representative.', reviewed_at=now()
from public.stat_categories c
where c.id=e.category_id and coalesce(c.source_indicator_code,c.indicator_code,'') in ('asylum-applications:coo:applied','population:coo:asylum_seekers');

-- Apply v15.6 decisions to runtime flags and player copy.
update public.stat_categories c
set title=e.player_title, short_title=left(regexp_replace(e.player_title,'^(Highest|Lowest|Largest|Most)\s+','','i'),70),
    description=coalesce(e.player_description,c.description), plain_language_description=coalesce(e.player_description,c.plain_language_description,c.description),
    enabled=e.editorial_outcome in ('daily','random','rewrite'), eligible_daily=e.editorial_outcome in ('daily','rewrite'),
    content_review_status=case when e.editorial_outcome in ('retired','duplicate') then 'excluded' when e.editorial_outcome='quarantined' then 'pending' else 'approved' end,
    player_quality_status=case when e.editorial_outcome in ('retired','duplicate') then 'blocked' when e.editorial_outcome='quarantined' then 'caution' else 'approved' end,
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('editorialOutcomeV15_6',e.editorial_outcome,'catalogDecisionReasonV15_6',e.decision_reason,'preferredCategoryId',e.preferred_category_id,'broadDomain',e.broad_domain,'knowledgeCluster',e.knowledge_cluster,'strategyFamily',e.strategy_family),
    updated_at=now()
from public.category_catalog_editorial_v15_6 e where c.id=e.category_id;

-- New source registrations are truthful: intake-ready, not active until observations are imported and reviewed.
insert into public.data_sources(id,name,status,description,display_order,metadata,created_at,updated_at) values
 ('unescoheritage','UNESCO World Heritage Centre','planned','Country counts of inscribed World Heritage properties.',38,'{"v15_6":"intake-ready"}'::jsonb,now(),now()),
 ('aquastat','FAO AQUASTAT','planned','Country water resources and water-stress indicators.',39,'{"v15_6":"intake-ready"}'::jsonb,now(),now()),
 ('usgsminerals','USGS Minerals','planned','Curated total mine-production categories for familiar minerals only.',40,'{"v15_6":"intake-ready"}'::jsonb,now(),now()),
 ('faofisheries','FAO Fisheries','planned','Curated total capture and aquaculture production categories.',41,'{"v15_6":"intake-ready"}'::jsonb,now(),now())
on conflict(id) do update set description=excluded.description,metadata=coalesce(public.data_sources.metadata,'{}'::jsonb)||excluded.metadata,updated_at=now();

-- Force a new rules version; invalid unscored boards are removed. Scored invalid boards remain archived rather than active.
create table if not exists public.daily_challenge_archive_v15_6 (like public.daily_challenges including all);
create table if not exists public.daily_score_archive_v15_6 (like public.daily_scores including all);

insert into public.daily_challenge_archive_v15_6
select challenge.* from public.daily_challenges challenge
where coalesce(challenge.rules_version,'') <> '12.2'
on conflict (challenge_date,difficulty) do update set
  seed=excluded.seed, encoded_board=excluded.encoded_board, board_hash=excluded.board_hash,
  dataset_version=excluded.dataset_version, rules_version=excluded.rules_version,
  category_set_version=excluded.category_set_version, created_at=excluded.created_at;

insert into public.daily_score_archive_v15_6
select score.* from public.daily_scores score
join public.daily_challenges challenge using(challenge_date,difficulty)
where coalesce(challenge.rules_version,'') <> '12.2'
on conflict (id) do nothing;

-- Old scored boards remain available in the archive tables, but are removed from
-- the active Daily tables so a broken historical board cannot disable today's game.
delete from public.daily_scores score using public.daily_challenges challenge
where score.challenge_date=challenge.challenge_date and score.difficulty=challenge.difficulty
  and coalesce(challenge.rules_version,'') <> '12.2';
delete from public.daily_challenges challenge where coalesce(challenge.rules_version,'') <> '12.2';

commit;
