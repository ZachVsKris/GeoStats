-- GeoStats v16.1 verification (read only)

select
  to_regprocedure('public.refresh_category_semantic_audit_v16_1()') is not null as semantic_audit_function_installed,
  to_regprocedure('public.finalize_v16_catalog()') is not null as finalizer_installed,
  to_regclass('public.category_semantic_audit_v16_1') is not null as semantic_audit_table_installed,
  to_regclass('public.category_full_audit_v16_1') is not null as full_audit_view_installed,
  to_regclass('public.category_runtime_review_v16') is not null as runtime_view_installed;

select * from public.category_review_overview_v16;

select
  (select count(*) from public.stat_categories) as categories,
  (select count(*) from public.category_semantic_audit_v16_1) as audited_categories,
  (select count(*) from public.stat_categories c left join public.category_semantic_audit_v16_1 a on a.category_id=c.id where a.category_id is null) as categories_missing_audit,
  (select count(*) from public.category_runtime_review_v16 where computed_playable_v16 and semantic_audit_status<>'pass') as playable_without_semantic_pass,
  (select count(*) from public.category_runtime_review_v16 where computed_playable_v16 and cardinality(semantic_audit_issues)>0) as playable_with_semantic_issues;

select audit_status,count(*) as categories
from public.category_semantic_audit_v16_1
group by audit_status
order by audit_status;

select
  count(*) filter(where v.computed_playable_v16 and (
    lower(coalesce(v.value_type,'')) like '%percent%'
    or position('%' in lower(coalesce(v.unit,'')))>0
    or lower(coalesce(v.unit,'')) like '%percent%'
  ) and (a.minimum_value<0 or a.maximum_value>100)) as playable_percent_out_of_bounds,
  count(*) filter(where v.computed_playable_v16 and v.source_indicator_code='PHE_HHAIR_POP_CLEAN_FUELS') as wrong_clean_cooking_series_playable,
  count(*) filter(where v.source_indicator_code='PHE_HHAIR_PROP_POP_CLEAN_FUELS' and v.semantic_audit_status='pass') as correct_clean_cooking_series_audited
from public.category_runtime_review_v16 v
join public.category_semantic_audit_v16_1 a on a.category_id=v.id;

select id,effective_title,description,icon,unit,semantic_audit_status,computed_playable_v16
from public.category_runtime_review_v16
where id like 'faostat-fbs:%'
   or id='unhcr:most-stateless-people'
   or source_indicator_code in ('PHE_HHAIR_POP_CLEAN_FUELS','PHE_HHAIR_PROP_POP_CLEAN_FUELS')
   or effective_title in (
     'Largest poultry meat exports','Largest spice exports','Largest forest area',
     'Highest share of land and sea protected'
   )
order by source_organization,effective_title;

select id,effective_title,source_organization,source_indicator_code,
       semantic_audit_status,semantic_audit_issues,semantic_audit_warnings,
       semantic_top_values,semantic_bottom_values
from public.category_runtime_review_v16
where semantic_audit_status in ('data_repair_required','rewrite_required','review_required')
order by computed_playable_v16 desc,source_organization,effective_title
limit 100;
