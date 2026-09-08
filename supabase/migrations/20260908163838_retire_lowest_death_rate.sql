begin;
select pg_advisory_xact_lock(hashtext('geostats-v16.3.4-runtime-catalog'));
insert into public.category_review_contracts_v16_3_4 as c(category_id,review_patch,presentation_patch)
values('unwpp:lowest-death-rate','{"status":"rejected","notes":"Explicit owner removal on 2026-09-08: Fewest annual deaths per 1,000 people"}'::jsonb,'{}'::jsonb)
on conflict(category_id) do update set review_patch=c.review_patch||excluded.review_patch,revision=c.revision+1,updated_at=now();
update public.category_review_state set status='rejected',notes='Explicit owner removal on 2026-09-08: Fewest annual deaths per 1,000 people',updated_at=now() where category_id='unwpp:lowest-death-rate';
update public.stat_categories set enabled=false,eligible_daily=false,review_status='rejected',curation_status='excluded',content_review_status='excluded',player_quality_status='blocked' where id='unwpp:lowest-death-rate';
do $$ begin
 if exists(select 1 from public.category_runtime_review_v16_2 where id='unwpp:lowest-death-rate' and (enabled or computed_playable_v16_2)) then raise exception 'Retirement did not reach runtime catalog'; end if;
end $$;
commit;
