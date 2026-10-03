create table public.animal_research_concepts(
id text primary key,bucket text not null,interest text not null check(interest in ('intuitive','specialist')),
recommendation text not null check(recommendation in ('keep','hold','reject')),
evidence_gate text not null,payload jsonb not null);
create table public.animal_research_prizes(
id text primary key,concept_id text not null references public.animal_research_concepts(id),
label text not null,endpoint text not null check(endpoint in ('high','low')),counter_id text,
unique(concept_id,endpoint));
create index animal_research_prizes_concept_idx on public.animal_research_prizes(concept_id);
create table public.animal_research_sources(
id text primary key,url text not null,record_count bigint not null check(record_count>=0),sha256 text not null,payload jsonb not null);
create table public.animal_research_checks(
concept_id text not null references public.animal_research_concepts(id),check_key text not null,
status text not null default 'pending' check(status in ('pending','pass','fail')),notes text,
primary key(concept_id,check_key));
alter table public.animal_research_concepts enable row level security;
alter table public.animal_research_prizes enable row level security;
alter table public.animal_research_sources enable row level security;
alter table public.animal_research_checks enable row level security;
revoke all on public.animal_research_concepts,public.animal_research_prizes,public.animal_research_sources,public.animal_research_checks from anon,authenticated;
grant all on public.animal_research_concepts,public.animal_research_prizes,public.animal_research_sources,public.animal_research_checks to service_role;
