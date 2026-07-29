-- GeoStats v15.6.1 verification. Read-only.

-- 1. Required patch tables.
select
  to_regclass('public.v15_6_1_category_backup') as category_backup,
  to_regclass('public.v15_6_1_decisions') as decisions;

-- 2. Every agreed decision and its current runtime state.
select
  decision.action,
  decision.prior_title,
  category.title,
  category.plain_language_description,
  category.source_indicator_code,
  category.enabled,
  category.eligible_daily,
  category.content_review_status,
  category.player_quality_status,
  decision.reason
from public.v15_6_1_decisions decision
join public.stat_categories category on category.id = decision.category_id
order by decision.action, category.title;

-- 3. These title checks should each return at least one row when the source
-- category exists in the warehouse.
select source_indicator_code, title, plain_language_description
from public.stat_categories
where source_indicator_code in (
  'EN.URB.LCTY',
  'AG.LND.TOTL.K2',
  'EN.GHG.ALL.MT.CE.AR5',
  'EN.ATM.PM25.MC.M3'
)
order by source_indicator_code;

-- 4. Ambiguous travel-services categories must not be playable. Must return 0.
select id, title, enabled, eligible_daily
from public.stat_categories
where title ~* 'travel services'
  and (enabled or eligible_daily);

-- 5. No nonpreferred total/per-capita greenhouse-gas duplicate should be
-- playable. Must return 0.
select id, title, source_indicator_code, enabled, eligible_daily
from public.stat_categories
where source_indicator_code <> 'EN.GHG.ALL.MT.CE.AR5'
  and (
    title ~* 'greenhouse gas emissions.*(per capita|per person)'
    or source_indicator_code in ('EN.GHG.ALL.PC.CE.AR5', 'EN.GHG.TOT.ZG.AR5')
  )
  and (enabled or eligible_daily);

-- 6. The preferred GHG category should be clear and approved.
select
  id, title, plain_language_description, source_indicator_code,
  enabled, eligible_daily, content_review_status, player_quality_status
from public.stat_categories
where source_indicator_code = 'EN.GHG.ALL.MT.CE.AR5';

-- 7. Mismatched current/future boards that remain are scored and therefore
-- intentionally preserved. Ideally this returns 0.
select
  challenge.challenge_date,
  challenge.difficulty,
  challenge.rules_version,
  count(score.id) as saved_scores
from public.daily_challenges challenge
left join public.daily_scores score
  on score.challenge_date = challenge.challenge_date
 and score.difficulty = challenge.difficulty
where challenge.challenge_date >= current_date
  and coalesce(challenge.rules_version, '') <> '12.2'
group by challenge.challenge_date, challenge.difficulty, challenge.rules_version
order by challenge.challenge_date, challenge.difficulty;

-- 8. The official/source wording remains recoverable.
select
  id,
  title as player_title,
  metadata->>'officialSourceTitleV15_6_1' as preserved_source_title,
  metadata->>'officialDescriptionV15_6_1' as preserved_source_description
from public.stat_categories
where id in (select category_id from public.v15_6_1_decisions)
order by title;
