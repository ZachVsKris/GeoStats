-- GeoStats v16.2.8 authenticated write-policy hardening

begin;

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "users insert own scores" on public.daily_scores;
create policy "users insert own scores"
on public.daily_scores
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "users update own scores" on public.daily_scores;
create policy "users update own scores"
on public.daily_scores
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

commit;
