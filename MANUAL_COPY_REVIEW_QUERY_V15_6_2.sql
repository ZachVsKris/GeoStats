-- Use after VERIFY_V15_6_2.sql when you are ready to manually review all
-- approved/playable category titles and descriptions.

select
  audit.category_id,
  category.source_organization,
  category.source_indicator_code,
  audit.title as current_player_title,
  audit.plain_language_description as current_player_description,
  category.metadata->>'officialSourceTitleV15_6_2' as preserved_source_title,
  category.metadata->>'officialDescriptionV15_6_2' as preserved_source_description,
  category.unit,
  category.common_year,
  category.common_year_coverage,
  audit.audit_reason,
  category.player_source_url
from public.category_copy_audit_v15_6_2 audit
join public.stat_categories category on category.id = audit.category_id
where category.enabled
  and category.eligible_daily
order by
  audit.needs_manual_copy_review desc,
  category.source_organization,
  audit.title;
