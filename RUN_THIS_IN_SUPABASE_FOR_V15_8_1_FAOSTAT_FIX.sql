-- GeoStats v15.8.1 focused FAOSTAT livestock-population correction
-- Safe to rerun. This restores only categories rejected by the v15.7 blanket
-- FAOSTAT rule. Yield and productivity measures remain rejected.

begin;

-- FAOSTAT QCL uses the official unit abbreviation "An" for animal counts.
-- Element 5111 is Stocks: a total live-animal population, not a yield.
update public.v15_8_faostat_policy_decisions decision
set
  decision = 'keep-livestock-population',
  reason = 'Clear national live-animal population total. FAOSTAT unit An means animals.',
  assessed_at = now()
from public.stat_categories category
where category.id = decision.category_id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';

-- Restore individual-species categories that were rejected only by v15.7.
update public.category_review_state review
set
  status = 'approved',
  recommended_title = case
    when category.source_indicator_code ~ '02132:5111$' then 'Largest donkey population'
    when category.source_indicator_code ~ '02112:5111$' then 'Largest buffalo population'
    when category.source_indicator_code ~ '02121[.]01:5111$' then 'Largest camel population'
    when category.source_indicator_code ~ '02111:5111$' then 'Largest cattle population'
    when category.source_indicator_code ~ '02123:5111$' then 'Largest goat population'
    when category.source_indicator_code ~ '02131:5111$' then 'Largest horse population'
    when category.source_indicator_code ~ '02133:5111$' then 'Largest mule and hinny population'
    when category.source_indicator_code ~ '02140:5111$' then 'Largest pig population'
    when category.source_indicator_code ~ '02122:5111$' then 'Largest sheep population'
    else coalesce(review.recommended_title, category.title)
  end,
  political_self_reported = false,
  confusing = false,
  esoteric = false,
  subjective_or_composite = false,
  stale_data = false,
  poor_coverage = false,
  duplicate_of = null,
  notes = concat_ws(
    E'\n',
    nullif(review.notes, ''),
    'v15.8.1: restored as a clear live-animal population total; FAOSTAT unit An means animals.'
  ),
  reviewed_at = coalesce(review.reviewed_at, now()),
  updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$'
  and category.source_indicator_code !~ '(F1746|F1749):5111$'
  and review.status = 'rejected'
  and coalesce(review.notes, '') like '%v15.7 production-only policy%';

-- Combined aggregates overlap with the individual categories. Preserve them for
-- manual review rather than retiring or automatically activating them.
update public.category_review_state review
set
  status = 'needs_rewrite',
  recommended_title = case
    when category.source_indicator_code ~ 'F1746:5111$' then 'Largest combined cattle and buffalo population'
    when category.source_indicator_code ~ 'F1749:5111$' then 'Largest combined sheep and goat population'
    else coalesce(review.recommended_title, category.title)
  end,
  duplicate_of = null,
  notes = concat_ws(
    E'\n',
    nullif(review.notes, ''),
    'v15.8.1: restored from blanket rejection but held for manual overlap review.'
  ),
  updated_at = now()
from public.stat_categories category
where review.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ '(F1746|F1749):5111$'
  and review.status = 'rejected'
  and coalesce(review.notes, '') like '%v15.7 production-only policy%';

update public.category_catalog_editorial_v15_6 editorial
set
  editorial_outcome = case
    when category.source_indicator_code ~ '(F1746|F1749):5111$' then 'rewrite'
    else 'daily'
  end,
  preferred_category_id = null,
  decision_reason = case
    when category.source_indicator_code ~ '(F1746|F1749):5111$'
      then 'Live-animal population total retained for manual overlap review.'
    else 'Clear live-animal population total restored after the v15.7 blanket FAOSTAT rule.'
  end,
  decision_source = 'v15.8.1 FAOSTAT livestock correction',
  reviewed_at = now()
from public.stat_categories category
where editorial.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$'
  and editorial.decision_source in ('v15.7 production-only policy', 'v15.8 FAOSTAT concept policy');

-- Use a player-readable unit while preserving the official abbreviation.
update public.stat_categories category
set
  unit = 'animals',
  unit_explanation = 'Number of live animals',
  plain_language_description = 'Total national population of this livestock species.',
  metadata = (coalesce(category.metadata, '{}'::jsonb) - 'faostatProductionOnlyV15_7')
    || jsonb_build_object(
      'faostatPolicyV15_8', 'keep-livestock-population',
      'faostatPolicyV15_8_1', 'keep-live-animal-population',
      'sourceUnit', coalesce(category.metadata->>'sourceUnit', 'An'),
      'boardDescription', 'Total national population of this livestock species.'
    ),
  updated_at = now()
where category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';

-- The prior ledger represented the superseded blanket policy and must no longer
-- claim that Stocks categories are prohibited non-production measures.
delete from public.v15_7_faostat_nonproduction_decisions prior
using public.stat_categories category
where prior.category_id = category.id
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';

select public.reconcile_category_playability_v15();

commit;

-- Expected: zero.
select count(*) as playable_yield_or_productivity
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id = queue.id
where queue.computed_playable_v15
  and category.source_organization = 'FAOSTAT'
  and lower(concat_ws(
    ' ', queue.effective_title, category.description,
    category.plain_language_description, category.technical_definition,
    category.unit
  )) ~ '(yield|kg/ha|tonnes?/ha|per hectare|area harvested|harvested area|carcass|slaughter|per animal|output per animal|producing animals|milk animals|laying hens?)';

-- Expected: at least the nine clear individual-species categories, subject to
-- any unrelated integrity blocker.
select count(*) as playable_livestock_population_categories
from public.category_review_queue_v15 queue
join public.stat_categories category on category.id = queue.id
where queue.computed_playable_v15
  and category.source_organization = 'FAOSTAT'
  and category.source_indicator_code ~ ':5111$';
