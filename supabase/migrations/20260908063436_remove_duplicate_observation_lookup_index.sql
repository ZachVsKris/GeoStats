-- Matches the migration already applied to the hosted project on 2026-09-08.
-- The valid primary key supplies the same ordered lookup keys.
set local lock_timeout = '2s';
do $$ begin
 if not exists (select 1 from pg_index where indexrelid='public.stat_observations_pkey'::regclass and indisvalid and indisprimary) then raise exception 'Valid observation primary key required'; end if;
end $$;
drop index if exists public.stat_observations_v144_lookup_idx;
