-- GeoStats v15.5.1: hard clarity gate, stronger retirement coverage,
-- cross-mode concept deduplication support, and Daily board refresh.
-- Rerunnable.

begin;

-- Retire contrived concepts by indicator code OR player-facing wording so
-- duplicate catalog IDs cannot evade the editorial decision.
with retirement_candidates as (
  select
    category.id,
    case
      when upper(coalesce(category.source_indicator_code,'')) like '%FI.RES.XGLD.CD'
        or lower(category.title) ~ 'total reserves minus gold'
        then 'Technical central-bank accounting concept: reserves excluding monetary gold.'
      when upper(coalesce(category.source_indicator_code,'')) like '%SP.URB.TOTL.MA.ZS'
        or lower(category.title) ~ 'population in urban agglomerations? of more than 1 million'
        then 'A threshold-defined urban-agglomeration measure is too contrived for intuitive gameplay.'
      when upper(coalesce(category.source_indicator_code,'')) like '%CM.MKT.TRAD.CD'
        or lower(category.title) ~ 'stocks traded,?[[:space:]]*total value'
        then 'A technical financial-market turnover measure is not an intuitive country fact.'
      when lower(category.title) ~ 'largest continuous land area'
        then 'A geometry-derived connected-land-piece measure is too contrived for gameplay.'
      when lower(concat_ws(' ',category.title,category.description,category.plain_language_description,category.technical_definition))
        ~ '(employment[- ]to[- ]population|output per worker|labor[- ]income share)'
        then 'A technical labor or productivity ratio is not intuitive enough for gameplay.'
      else null
    end as reason
  from public.stat_categories category
), retired as (
  select * from retirement_candidates where reason is not null
)
insert into public.category_catalog_editorial_v15_5(
  category_id,editorial_outcome,player_title,player_description,broad_domain,
  knowledge_cluster,strategy_family,preferred_category_id,wonkiness_score,clarity_score,
  decision_reason,decision_source,reviewed_at
)
select
  category.id,
  'retired',
  category.title,
  coalesce(category.plain_language_description,category.description),
  coalesce(category.metadata->>'broadDomain',lower(category.family)),
  coalesce(category.metadata->>'knowledgeCluster',category.semantic_family,category.concept_group,lower(category.family)),
  coalesce(category.metadata->>'strategyFamily',category.semantic_family,category.concept_group,lower(category.family)),
  null,
  100,
  10,
  retired.reason,
  'v15.5.1 hard clarity retirement',
  now()
from retired
join public.stat_categories category on category.id=retired.id
on conflict(category_id) do update set
  editorial_outcome='retired',
  wonkiness_score=100,
  clarity_score=10,
  decision_reason=excluded.decision_reason,
  decision_source=excluded.decision_source,
  reviewed_at=now();

-- Rewrite clear underlying concepts whose source wording is unnecessarily stiff.
with rewrites(old_title,new_title,new_description) as (
  values
    ('Highest safely managed drinking-water access','Best access to safe drinking water',
     'Percentage of the population using drinking water that is available when needed and free from contamination.'),
    ('Highest STEM graduate share','Highest share of STEM graduates',
     'Percentage of graduates whose field is science, technology, engineering or mathematics.'),
    ('Largest potato exports','Most potato exports',
     'Annual value of potato exports to the world.')
)
update public.category_catalog_editorial_v15_5 editorial
set player_title=rewrites.new_title,
    player_description=rewrites.new_description,
    clarity_score=greatest(editorial.clarity_score,90),
    decision_reason='Clear concept with simplified player-facing wording.',
    decision_source='v15.5.1 player-title rewrite',
    reviewed_at=now()
from public.stat_categories category
join rewrites on lower(category.title)=lower(rewrites.old_title)
where editorial.category_id=category.id
  and editorial.editorial_outcome<>'retired';

-- The runtime code now treats rules 12.0 boards as stale. Remove only unscored
-- boards so they regenerate under the v15.5.1 clarity and cross-mode dedup rules.
delete from public.daily_challenges challenge
where coalesce(challenge.rules_version,'')<>'12.1'
  and not exists (
    select 1
    from public.daily_scores score
    where score.challenge_date=challenge.challenge_date
  );

commit;
