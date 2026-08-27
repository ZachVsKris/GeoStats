Replace these files in GitHub. This V3 hotfix rolls up all SQL fixes discovered
against the real production v16.2.5 schema:
- explicit analytics_overview_30d average_score -> average_percent view rename
- category_auto_vetting_v16 typo corrected to category_auto_vetting_v15_9
- eligible-universe migration no longer assumes old SELECT * views auto-expand
- runtime v16_2 view explicitly exposes eligible-universe fields
- migration 049 preserves those fields when adding the legacy-rejection guard
