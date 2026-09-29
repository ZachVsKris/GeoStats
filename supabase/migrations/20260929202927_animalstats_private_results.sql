-- Separate AnimalStats account history. Existing Countries scores are untouched.
create table public.animal_game_results (
 user_id uuid not null references auth.users(id) on delete cascade,
 game_id text not null,
 board_id text not null,
 challenge_date date not null,
 difficulty text not null check (difficulty in ('easy','normal','expert')),
 play_kind text not null check (play_kind in ('daily','random')),
 score integer not null check (score >= 0 and score <= 600),
 optimal_choices integer not null check (optimal_choices >= 0 and optimal_choices <= 6),
 average_placement numeric not null check (average_placement >= 1 and average_placement <= 8),
 assignments jsonb not null check (jsonb_typeof(assignments) = 'object'),
 ranks jsonb not null check (jsonb_typeof(ranks) = 'array'),
 dataset_fingerprint text not null,
 rules_version text not null default 'animalstats-v1',
 completed_at timestamptz not null default now(),
 primary key (user_id, game_id)
);
create index animal_game_results_history on public.animal_game_results(user_id, challenge_date desc, completed_at desc);
alter table public.animal_game_results enable row level security;
revoke all on public.animal_game_results from anon, authenticated;
grant select on public.animal_game_results to authenticated;
grant select, insert on public.animal_game_results to service_role;
create policy animal_results_owner_read on public.animal_game_results
 for select to authenticated using ((select auth.uid()) = user_id);
comment on table public.animal_game_results is 'Server-scored private AnimalStats history, isolated from Countries. Browser clients may only read their own rows.';
