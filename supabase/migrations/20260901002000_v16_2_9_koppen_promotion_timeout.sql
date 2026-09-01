begin;

-- The bounded promotion refreshes several whole-catalog materialized audits.
-- Allow the same five-minute budget already used by the catalog finalizer.
alter function public.promote_v16_2_9_koppen_bundle()
  set statement_timeout='300s';

commit;
