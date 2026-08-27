const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const failures = [];
const check = (c,m) => { if (!c) failures.push(m); };
const migration = read('supabase/migrations/047_v16_2_6_full_release.sql');
const legacyMigration = read('supabase/migrations/049_v16_2_6_legacy_rejection_guard.sql');
const legacyReauditMigration = read('supabase/migrations/050_v16_2_6_priority_150_legacy_reaudit.sql');
const fullLegacyReauditMigration = read('supabase/migrations/051_v16_2_6_full_791_legacy_reaudit.sql');
const workbenchRepairMigration = read('supabase/migrations/052_v16_2_6_admin_workbench_contract_repair.sql');
const catalogRecoveryMigration = read('supabase/migrations/053_v16_2_6_catalog_regression_recovery.sql');
const installer = read('RUN_THIS_IN_SUPABASE_FOR_V16_2_6.sql');
const verifier = read('VERIFY_V16_2_6.sql');
for (const token of [
  'category_v16_2_6_hard_block_reason','apply_v16_2_6_catalog_curation','assert_v16_2_6_release',
  'v16_2_6_category_state_backup','internal_testers','profiles_entitlement_v16_2_6_check',
  'analytics_events_acquisition_v16_2_6_idx','average_percent','analytics_acquisition_30d',
  'EN.URB.LCTY','AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5',
  "\\.(CN|KN)$",'v16_2_6_same_source_retry','v16_2_6_repair_evidence',
  'United Nations Population Division','World Bank Climate Change Knowledge Portal','International Monetary Fund',
  'NOAA National Centers for Environmental Information','FAO AQUASTAT','FAO Fisheries','USGS Minerals',
  'World Health Organization','UN DESA International Migrant Stock 2024','World Trade Organization','UN Tourism',
  'users read own profile','users read own scores','category_decisions_v16_2_6',
]) check(migration.includes(token), `migration missing ${token}`);

for (const id of ['unwpp','worldbankclimate','imfweo','unescoich','noaatsunami','aquastat','faofisheries','usgsminerals','whoghed','undesamigrant','wtoservices','untourismdirect']) {
  check(new RegExp(`\\('${id}'[\\s\\S]*?::jsonb\\)(?:,|\\n\\s*on conflict)`).test(migration), `data_sources tuple malformed or missing for ${id}`);
}

check((migration.match(/'remove'/g) || []).length >= 32, 'clarify/remove hard decisions are incomplete');
check(migration.includes("measurement_type='total',value_type='total'"), 'largest-city absolute-population type correction missing');
check(!migration.includes("value_type='number'"), 'invalid value_type number slipped into migration');
check(migration.includes("p_source_organization='World Bank'"), 'World Bank-specific local-currency guard missing');
check(migration.includes("computed_playable_v16_2") && migration.includes('hard_block_reason'), 'runtime hard gate is not wired to computed playability');
for (const f of ['RUN_THIS_IN_SUPABASE_FOR_V16_2_6.sql','VERIFY_V16_2_6.sql','ROLLBACK_V16_2_6.sql']) {
  check(fs.existsSync(path.join(root,f)), `${f} missing`);
}

for (const token of [
  'legacy_category_rejections_v16_2_6','category_legacy_rejection_resolutions_v16_2_6',
  'tracker_legacy_rejection_collisions_v16_2_6','legacy_rejection_semantic_aliases_v16_2_6','category_legacy_rejection_blockers_v16_2_6',
  'legacy_rejection_reaudit','cleared_for_reconsideration','cardinality(legacy.blockers)=0'
]) check(legacyMigration.includes(token), `legacy rejection migration missing ${token}`);
check(installer.includes('geostats-v16.2.6-legacy-rejection-guard'), 'cumulative installer missing migration 049');
for (const token of ['legacy_rejection_first_principles_reaudit_v16_2_6','clear_generic_legacy_block','confirm_reasoned_exclusion','cleared_for_reconsideration','reaudit_guard_action']) check(legacyReauditMigration.includes(token), `priority-150 re-audit migration missing ${token}`);
check(installer.includes('geostats-v16.2.6-priority-150-legacy-reaudit'), 'cumulative installer missing migration 050');
for (const token of ['geostats-v16.2.6-full-legacy-reaudit','confirmed_exclusion','cleared_for_reconsideration','requires_reaudit']) check(fullLegacyReauditMigration.includes(token), `full-791 re-audit migration missing ${token}`);
check(installer.includes('geostats-v16.2.6-full-legacy-reaudit'), 'cumulative installer missing migration 051');
for (const token of ['geostats-v16.2.6-admin-workbench-contract-repair','release_disposition_v16_2_3','release_disposition_reason_v16_2_3','category_release_decisions_v16_2_3']) check(workbenchRepairMigration.includes(token), `Admin Workbench repair migration missing ${token}`);
check(installer.includes('geostats-v16.2.6-admin-workbench-contract-repair'), 'cumulative installer missing migration 052');

for (const token of [
  'geostats-v16.2.6-catalog-regression-recovery',
  'geostats-v16.2.6-semantic-audit-v2',
  'refresh_category_semantic_audit_v16_1',
  'refresh_category_promotion_assessment_v16_2',
  'refresh_v16_2_runtime_catalog'
]) check(catalogRecoveryMigration.includes(token), `catalog recovery migration missing ${token}`);
check(!catalogRecoveryMigration.includes("and lower(v.source_organization) not in ('unesco uis','u.s. eia')"), 'migration 053 still contains the accidental provider-wide UIS/EIA ban');
check(!catalogRecoveryMigration.includes("case when c.is_percentage and (c.minimum_value<0 or c.maximum_value>100)\n          then format('Percentage values fall outside 0-100"), 'migration 053 still hard-blocks every percentage-like value outside 0..100');
check(catalogRecoveryMigration.includes("measurement_type_lower not in ('per_capita','per capita','per-person','per person')"), 'migration 053 does not respect explicit per-capita measurement metadata');
check(installer.includes('geostats-v16.2.6-catalog-regression-recovery'), 'cumulative installer missing migration 053');

check(verifier.includes('legacy_rejection_blockers_v16_2_6') && verifier.includes('tracker_legacy_rejection_collisions_v16_2_6'), 'verification SQL missing legacy rejection checks');
if (failures.length) { console.error('GeoStats v16.2.6 SQL checks FAILED:\n'+failures.map(x=>' - '+x).join('\n')); process.exit(1); }
console.log('GeoStats v16.2.6 SQL checks passed.');
