-- LOCAL EXPERIMENT ONLY. Do not apply this file to the hosted database.
-- The runner creates baseline from a verified export of geography observations.
create table metadata_dictionary as
select row_number() over (order by metadata)::integer as id,
       metadata, md5(metadata::text) as fingerprint
from (select distinct metadata from baseline) d;
alter table metadata_dictionary add primary key (id);
create index metadata_dictionary_fingerprint_idx on metadata_dictionary(fingerprint);
create table source_dictionary as
select row_number() over (order by source_url)::integer as id, source_url
from (select distinct source_url from baseline where source_url is not null) d;
alter table source_dictionary add primary key (id);
create unique index source_dictionary_url_idx on source_dictionary(source_url);
create table compact_observations (
  category_id text not null, country_iso3 text not null, country_name text not null,
  data_year smallint not null, value double precision not null,
  source_id integer references source_dictionary(id), source_record_id text,
  imported_at timestamptz not null, metadata_id integer not null references metadata_dictionary(id)
);
-- Compare full JSON values as well as fingerprints: hash collisions cannot merge records.
insert into compact_observations
select o.category_id,o.country_iso3,o.country_name,o.data_year,o.value,
       s.id,o.source_record_id,o.imported_at,m.id
from baseline o
join metadata_dictionary m on m.fingerprint=md5(o.metadata::text) and m.metadata=o.metadata
left join source_dictionary s on s.source_url=o.source_url
order by o.category_id,o.country_iso3,o.data_year;
create view compatibility_observations with (security_invoker=true) as
select o.category_id,o.country_iso3,o.country_name,o.data_year,o.value,
       s.source_url,o.source_record_id,o.imported_at,m.metadata
from compact_observations o
left join metadata_dictionary m on m.id=o.metadata_id
left join source_dictionary s on s.id=o.source_id;
-- LEFT joins with unique dictionary keys let Postgres eliminate both joins
-- when gameplay requests only ranking columns. Foreign keys prevent missing metadata.
