// Runs the exact operational SQL against isolated PostgreSQL 17 via PGlite.
// Usage: node scripts/test-observation-compaction.mjs /path/to/pglite/dist/index.js
import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(pathToFileURL(process.argv[2]));
const db=await PGlite.create();
const q=async(sql,params=[]) => (await db.query(sql,params)).rows;
const file=name=>readFileSync(new URL('../supabase/maintenance/'+name,import.meta.url),'utf8');
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create table public.stat_categories(id text primary key,enabled boolean not null);
insert into stat_categories values('enabled',true),('disabled',false);
grant select on stat_categories to anon,authenticated;
create table public.stat_observations(category_id text not null references stat_categories(id) on delete cascade,
country_iso3 text not null check(country_iso3~'^[A-Z]{3}$'),country_name text not null,
data_year smallint not null check(data_year between 1900 and 2100),value double precision not null,
source_url text,source_record_id text,imported_at timestamptz not null default now(),metadata jsonb not null default '{}',
primary key(category_id,country_iso3,data_year));
create function force_canonical_observation_country_name() returns trigger language plpgsql as $$begin
if new.country_iso3='USA' then new.country_name:='United States';end if;return new;end$$;
create trigger force_canonical_observation_country_name before insert or update of country_iso3,country_name on stat_observations for each row execute function force_canonical_observation_country_name();
create view stat_latest_values as select category_id,country_iso3,value from stat_observations;
create view nested_observation_view as select * from stat_latest_values;
insert into stat_observations(category_id,country_iso3,country_name,data_year,value,metadata)
values('enabled','USA','America',2024,1.2345678901234567,'{"provenance":"source","nullValue":null}'),('disabled','CAN','Canada',2024,2,'{}');`);
await db.exec('begin;'+file('prepare-observation-compaction.sql')+'commit;');
assert.equal(Number((await q("select geostats_maintenance.copy_categories(array['enabled','disabled']) as n"))[0].n),2);
// Exercise writes between batches, including a key update and deletion.
await db.exec(`update stat_observations set value=7,metadata='{"updated":true}' where category_id='enabled';
insert into stat_observations(category_id,country_iso3,country_name,data_year,value) values('enabled','FRA','France',2024,3);
update stat_observations set country_iso3='DEU',country_name='Germany' where country_iso3='FRA';
delete from stat_observations where country_iso3='DEU';`);
await db.exec('begin;'+file('index-observation-compaction.sql')+'commit;');
const before=await q('select * from stat_observations order by category_id,country_iso3,data_year');
assert.deepEqual(await q('select * from geostats_maintenance.observations_compact order by category_id,country_iso3,data_year'),before);
// An unexpected dependency must abort safely and retain the old table.
await db.exec('create table incoming_reference(category_id text,country_iso3 text,data_year smallint,foreign key(category_id,country_iso3,data_year) references stat_observations)');
await assert.rejects(db.exec('begin;'+file('finish-observation-compaction.sql')+'commit;'),/Incoming foreign key/);
await db.exec('rollback;drop table incoming_reference;');
assert.deepEqual(await q('select * from stat_observations order by category_id,country_iso3,data_year'),before);
await db.exec('begin;'+file('finish-observation-compaction.sql')+'commit;');
assert.deepEqual(await q('select * from stat_observations order by category_id,country_iso3,data_year'),before);
assert.equal((await q('select * from nested_observation_view')).length,2);
assert.equal((await q("select relkind from pg_class where oid='public.stat_observations'::regclass"))[0].relkind,'r');
await db.exec(`insert into stat_observations(category_id,country_iso3,country_name,data_year,value) values('enabled','USA','America',2024,9)
on conflict(category_id,country_iso3,data_year) do update set value=excluded.value,country_name=excluded.country_name;`);
assert.equal((await q("select country_name from stat_observations where country_iso3='USA'"))[0].country_name,'United States');
await db.exec('set role anon');
assert.equal((await q('select * from stat_observations')).length,1);
await db.exec('delete from stat_observations');
assert.equal((await q('select * from stat_observations')).length,1);
await db.exec('reset role');
await db.exec("delete from stat_categories where id='disabled'");
assert.equal((await q('select * from stat_observations')).length,1);
assert.equal((await q("select count(*) as n from pg_index where indrelid='public.stat_observations'::regclass and indisvalid"))[0].n,5);
console.log('PASS: exact data, writes between batches, key changes, deletes, safe-abort dependency guard, nested views, canonical names, existing upserts, RLS, cascade deletion, five indexes');
await db.close();
