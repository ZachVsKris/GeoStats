-- Consolidate redundant player-facing taxonomy labels without changing category data.
-- Population measures belong to demographics; Natural Earth geometry belongs to
-- physical geography. This keeps the daily-board domain vocabulary coherent.

begin;

update public.stat_categories
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'broadDomain', 'demographics',
  'knowledgeCluster', coalesce(nullif(metadata->>'knowledgeCluster', ''), 'demographics')
)
where metadata->>'broadDomain' = 'population';

update public.stat_categories
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
  'broadDomain', 'physical-geography',
  'knowledgeCluster', coalesce(nullif(metadata->>'knowledgeCluster', ''), 'physical-geography')
)
where metadata->>'broadDomain' = 'geography';

commit;
