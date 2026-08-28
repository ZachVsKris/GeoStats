begin;

-- The physical-geography curation deliberately refreshes the full catalog after
-- its seven explicit decisions. On the production-sized catalog that work can
-- exceed PostgREST's default statement timeout, so give this guarded service-role
-- function the same budget as the existing v16.2.7 staging function.
alter function public.apply_v16_2_7_physical_geography_curation()
  set statement_timeout='300s';

commit;
