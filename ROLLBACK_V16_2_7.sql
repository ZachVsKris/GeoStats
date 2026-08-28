-- GeoStats v16.2.7 CONSERVATIVE emergency rollback.
-- This intentionally does NOT mass-restore old catalog decisions. v16.2.7 can
-- reopen inherited generic exclusions after current-source validation; blindly
-- reversing those decisions would be less safe than leaving them for review.
begin;
-- Remove new sports categories from gameplay while preserving their observations
-- and provenance for diagnosis/review.
update public.stat_categories
set enabled=false,eligible_daily=false,updated_at=now()
where id in ('sports:fifa-world-cup-first-appearance','sports:modern-olympics-first-appearance');
-- Clear v16.2.7 reachability evidence so no stale proof can be mistaken for a
-- current production assertion after a code rollback.
truncate table public.generator_reachability_v16_2_7;
commit;
