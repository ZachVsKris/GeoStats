begin isolation level repeatable read;
create temporary table launch_baseline as select * from public.launch_funnel_v1;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); stamp timestamptz:=now()-interval '3 days'; f record; base record; i integer;
begin
 insert into public.analytics_events(event_name,session_id,visitor_id,created_at,challenge_date,difficulty,is_internal) values
 ('page_view','launch-fixture-a',a,stamp,(stamp at time zone 'America/New_York')::date,'easy',false),
 ('game_started','launch-fixture-a',a,stamp+interval '1 minute',(stamp at time zone 'America/New_York')::date,'easy',false),
 ('game_completed','launch-fixture-a',a,stamp+interval '2 minutes',(stamp at time zone 'America/New_York')::date,'easy',false),
 ('game_started','launch-fixture-a',a,stamp+interval '3 minutes',(stamp at time zone 'America/New_York')::date,'normal',false),
 ('page_view','launch-fixture-a-next',a,stamp+interval '1 day',(stamp at time zone 'America/New_York')::date+1,'easy',false),
 ('game_started','launch-fixture-b',b,stamp,(stamp at time zone 'America/New_York')::date,'easy',false),
 ('game_started','launch-fixture-internal',c,stamp,(stamp at time zone 'America/New_York')::date,'easy',true);
 select * into f from public.launch_funnel_v1; select * into base from launch_baseline;
 if f.visitors-base.visitors<>2 or f.starters-base.starters<>2 or f.finishers-base.finishers<>1 or f.second_game_players-base.second_game_players<>1 or f.next_day_returners-base.next_day_returners<>1 or f.retention_eligible-base.retention_eligible<>2 then raise exception 'funnel fixture failed: %',row_to_json(f); end if;
 for i in 1..5 loop
  perform public.submit_player_report_v1('bug','Synthetic rollback-only test report',null,null,'easy','/daily',null,repeat('f',64));
 end loop;
 begin
  perform public.submit_player_report_v1('bug','Sixth rollback-only test report',null,null,'easy','/daily',null,repeat('f',64));
  raise exception 'rate limit failed';
 exception when sqlstate 'P0001' then
  if sqlerrm<>'report_rate_limit' then raise; end if;
 end;
end $$;
rollback;
select 'PASS: funnel cohorts, second-game sequencing, internal exclusion, five-report rate limit; fixtures rolled back' as verification;
