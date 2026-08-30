-- GeoStats v16.2.8 optional database rollback.
-- First promote the last known-good application deployment. The v16.2.8
-- migrations are backward-compatible, so leaving them installed is preferred.

begin;

drop view if exists public.analytics_country_engagement_30d;
drop view if exists public.analytics_category_engagement_30d;
drop view if exists public.analytics_difficulty_30d;
drop view if exists public.analytics_acquisition_30d;
drop view if exists public.analytics_overview_30d;

-- Preserve account_authenticated in the event constraint because rows may
-- already exist. Removing an accepted event name is not a safe rollback.

drop policy if exists "Admins can verify their own access" on public.app_admins;
create policy "Admins can verify their own access"
on public.app_admins for select
using (auth.uid() = user_id);

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "users read own scores" on public.daily_scores;
create policy "users read own scores"
on public.daily_scores for select
using (auth.uid() = user_id);

drop policy if exists "users insert own scores" on public.daily_scores;
create policy "users insert own scores"
on public.daily_scores for insert
with check (auth.uid() = user_id);

drop policy if exists "users update own scores" on public.daily_scores;
create policy "users update own scores"
on public.daily_scores for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

commit;

