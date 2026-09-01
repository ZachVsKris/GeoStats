begin;

with definitions(id,description) as (values
 ('education','Government education spending as a percentage of the country’s total economic output; this is what GDP measures.'),
 ('arableHa','Land suitable for temporary crops or pasture, measured in hectares; this is what “arable” means here.'),
 ('unwpp:highest-male-life-expectancy','Years a newborn boy would live if current male death rates stayed the same throughout his life.'),
 ('worldbank-catalog:bm-gsr-tran-zs','Passenger and freight transport bought from providers abroad as a percentage of all services bought from abroad.'),
 ('worldbank-catalog:eg-use-comm-cl-zs','Percentage of energy use supplied by hydropower, nuclear, geothermal and solar power, among other non-fossil sources.'),
 ('worldbank-catalog:eg-use-crnw-zs','Percentage of energy use supplied by burnable plant material, animal waste and municipal or industrial waste; this is what biomass and waste means here.'),
 ('worldbank-catalog:ms-mil-xpnd-zs','Military spending as a percentage of all spending by national, regional and local government.'),
 ('worldbank-catalog:er-mrn-ptmr-zs','Percentage of waters under the country’s jurisdiction that are designated as marine protected areas.'),
 ('worldbank-catalog:gc-tax-totl-gd-zs','Tax revenue as a percentage of the country’s total economic output; this is what GDP measures.'),
 ('history:worldbank-life-expectancy-70','Year life expectancy first reached 70 years; life expectancy estimates how long a newborn would live if current death rates stayed the same.')
)
update public.stat_categories c
set description=d.description,
    plain_language_description=d.description,
    metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object(
      'plainLanguageDescription',d.description,
      'boardDescription',d.description,
      'contentReviewVersion','geostats-v16.3.0-definition-audit'
    ),
    content_review_status='approved',
    content_review_reason='v16.3.0 terminology audit: specialist term defined in player copy.',
    content_review_version='geostats-v16.3.0-definition-audit',
    updated_at=now()
from definitions d where c.id=d.id;

do $$ begin
 if exists(select 1 from public.category_copy_clarity_v16_2_8 where cardinality(issues)>0) then
   raise exception 'v16.3.0 terminology update failed the playable copy gate';
 end if;
end $$;

commit;
