-- GeoStats v13.4.2 verification
-- The first result is informational. Every value in the second and third results must be 0.
select source_organization,curation_status,count(*) as categories,
       count(*) filter(where enabled) as enabled
from public.stat_categories
group by source_organization,curation_status
order by source_organization,curation_status;

select
  count(*) filter(where enabled and curation_status<>'approved') as enabled_without_editorial_approval,
  count(*) filter(where curation_status='approved' and not exists (
    select 1 from public.stat_category_curation_rules rule
    where rule.source_organization=stat_categories.source_organization
      and rule.source_indicator_code=stat_categories.source_indicator_code
      and rule.decision='approved'
  )) as approved_without_approved_rule,
  count(*) filter(where enabled and source_organization='FAOSTAT' and lower(title) like '%harvested area%') as enabled_harvested_area,
  count(*) filter(where enabled and source_organization='FAOSTAT' and (lower(title) like '%producing animals%' or lower(title) like '%milk-producing animals%' or lower(title) like '%laying animals%')) as enabled_technical_animal_counts,
  count(*) filter(where enabled and source_organization='FAOSTAT' and (lower(title) like '%n.e.c.%' or lower(title) like '%offal%' or lower(title) like '%equivalent%' or lower(title) like '%hides%')) as enabled_obscure_faostat,
  count(*) filter(where enabled and source_organization='ILOSTAT' and coalesce(common_year,latest_available_year,9999)>extract(year from current_date)::integer-1) as enabled_future_ilostat,
  count(*) filter(where enabled and source_organization='World Bank' and source_indicator_code in ('SP.RUR.TOTL','SP.URB.TOTL','NE.EXP.GNFS.CD','NE.IMP.GNFS.CD','NE.CON.GOVT.CD','NE.CON.PRVT.CD','NV.SRV.TOTL.ZS','AG.LND.AGRI.K2','AG.LND.AGRI.ZS')) as enabled_known_world_bank_duplicates
from public.stat_categories;

select
  abs(count(*) filter(where decision='approved')-205) as approved_rule_count_violation,
  abs(count(*) filter(where decision='excluded')-248) as excluded_rule_count_violation,
  abs(count(*)-453) as reviewed_rule_count_violation
from public.stat_category_curation_rules
where version='geostats-v13.4.2-editorial-v1';

select curation_reason,count(*) as categories
from public.stat_categories
where curation_status='excluded'
group by curation_reason
order by categories desc,curation_reason;
