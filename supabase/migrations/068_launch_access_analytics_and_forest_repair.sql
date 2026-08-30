begin;

-- The source is World Bank AG.LND.FRST.ZS: forest area as a percentage of
-- land area. The legacy row accidentally retained a lowest-wins direction
-- under a highest-coverage title. Make both the ranking and player-facing
-- percentage semantics explicit, then let the established fail-closed audit
-- recompute promotion eligibility.
update public.stat_categories
set title='Highest share of land covered by forest',
    short_title='Highest forest coverage',
    ranking_direction='high',
    updated_at=now()
where id='leastForest'
  and source_organization='World Bank'
  and source_indicator_code='AG.LND.FRST.ZS';

select public.refresh_category_ranking_completeness_v16();
select public.refresh_category_semantic_audit_v16_1();
select public.refresh_category_promotion_assessment_v16_2();

-- Account-access funnel events stay first-party and use the same private
-- analytics table as page/game events.
alter table public.analytics_events
  drop constraint if exists analytics_events_name_check;
alter table public.analytics_events
  add constraint analytics_events_name_check check (event_name in (
    'page_view','game_started','game_completed','share_clicked','source_opened',
    'account_username_saved','account_signin_requested','account_gate_opened'
  ));

commit;
