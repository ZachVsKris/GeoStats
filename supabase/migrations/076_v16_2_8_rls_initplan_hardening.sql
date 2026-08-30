-- GeoStats v16.2.8 RLS performance hardening
-- Cache auth.uid() once per statement instead of re-evaluating it per row.

begin;

drop policy if exists "Admins can verify their own access" on public.app_admins;
create policy "Admins can verify their own access"
on public.app_admins
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "users read own scores" on public.daily_scores;
create policy "users read own scores"
on public.daily_scores
for select
to authenticated
using ((select auth.uid()) = user_id);

commit;
