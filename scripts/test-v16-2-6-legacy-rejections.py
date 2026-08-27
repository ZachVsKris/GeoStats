import csv
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIT = ROOT / "audits" / "v16-2-6-legacy-rejections"
MIGRATION = ROOT / "supabase" / "migrations" / "049_v16_2_6_legacy_rejection_guard.sql"
REAUDIT_MIGRATION = ROOT / "supabase" / "migrations" / "050_v16_2_6_priority_150_legacy_reaudit.sql"
FULL_REAUDIT_MIGRATION = ROOT / "supabase" / "migrations" / "051_v16_2_6_full_791_legacy_reaudit.sql"

registry = list(csv.DictReader((AUDIT / "LEGACY_REJECTION_REGISTRY_DURABLE.csv").open(newline="", encoding="utf-8")))
collisions = list(csv.DictReader((AUDIT / "TRACKER_EXACT_TITLE_COLLISIONS_68.csv").open(newline="", encoding="utf-8")))
priority = list(csv.DictReader((AUDIT / "PRIORITY_150_GENERIC_NON_FAOSTAT_REJECTIONS.csv").open(newline="", encoding="utf-8")))
semantic = list(csv.DictReader((AUDIT / "SEMANTIC_COLLISION_REVIEW_SEED.csv").open(newline="", encoding="utf-8")))
reaudit = list(csv.DictReader((AUDIT / "PRIORITY_150_FIRST_PRINCIPLES_REAUDIT.csv").open(newline="", encoding="utf-8")))
sql = MIGRATION.read_text(encoding="utf-8")
reaudit_sql = REAUDIT_MIGRATION.read_text(encoding="utf-8")
full_reaudit_sql = FULL_REAUDIT_MIGRATION.read_text(encoding="utf-8")
full_reaudit = list(csv.DictReader((AUDIT / "FULL_791_FIRST_PRINCIPLES_REAUDIT.csv").open(newline="", encoding="utf-8")))

assert len(registry) == 791, len(registry)
assert len(collisions) == 68, len(collisions)
assert len(priority) == 150, len(priority)
assert len(semantic) == 12, len(semantic)
assert len(reaudit) == 150, len(reaudit)
assert len(full_reaudit) == 791, len(full_reaudit)

basis = Counter(row["legacy_rejection_basis_seed"] for row in registry)
assert basis == {
    "generic_v15_rejected_only": 610,
    "generic_v16_2_3_batch_reason": 168,
    "category_specific_or_product_decision": 10,
    "duplicate_explicit": 3,
}, basis

collision_basis = Counter(row["legacy_rejection_basis_seed"] for row in collisions)
assert collision_basis["category_specific_or_product_decision"] == 2
assert collision_basis["duplicate_explicit"] == 2
assert sum(collision_basis.values()) == 68

assert all(row["legacy_rejection_basis_seed"] == "generic_v15_rejected_only" for row in priority)
assert all(row["source"] != "FAOSTAT" for row in priority)

reaudit_disp = Counter(row["editorial_disposition"] for row in reaudit)
assert reaudit_disp == {
    "advance_to_validation": 39,
    "hold_for_family_curation": 38,
    "retain_exclusion": 72,
    "clear_legacy_block_current_path_governs": 1,
}, reaudit_disp
reaudit_guard = Counter(row["legacy_guard_action"] for row in reaudit)
assert reaudit_guard == {
    "clear_generic_legacy_block": 40,
    "keep_reaudit_block": 38,
    "confirm_reasoned_exclusion": 72,
}, reaudit_guard
assert len({row["source_line"] for row in reaudit}) == 150
assert {row["source_line"] for row in reaudit} == {row["source_line"] for row in priority}

full_guard = Counter(row["legacy_guard_action"] for row in full_reaudit)
assert full_guard == {"confirm_reasoned_exclusion": 744, "clear_generic_legacy_block": 47}, full_guard
assert not any(row["legacy_guard_action"] == "keep_reaudit_block" for row in full_reaudit)
assert len({row["source_line"] for row in full_reaudit}) == 791

for token in (
    "legacy_category_rejections_v16_2_6",
    "category_legacy_rejection_resolutions_v16_2_6",
    "tracker_legacy_rejection_collisions_v16_2_6",
    "legacy_rejection_semantic_aliases_v16_2_6",
    "category_legacy_rejection_blockers_v16_2_6",
    "legacy_rejection_reaudit",
    "cleared_for_reconsideration",
    "match_type in ('exact_title','source_indicator','semantic')",
    "cardinality(legacy.blockers)=0",
):
    assert token in sql, token

# The migration must carry the complete registry and collision classification,
# not merely create empty tables that depend on a vanished chat artifact.
assert len(re.findall(r"\('legacy:\d+'", sql)) == 791
assert len(re.findall(r"\('(existing:|candidate:|family:)", sql)) >= 68

for token in (
    "legacy_rejection_first_principles_reaudit_v16_2_6",
    "cleared_for_reconsideration",
    "clear_generic_legacy_block",
    "keep_reaudit_block",
    "confirm_reasoned_exclusion",
    "reaudit_disposition",
    "reaudit_guard_action",
):
    assert token in reaudit_sql, token
assert len(re.findall(r"\('legacy:\d+'", reaudit_sql)) == 150
for token in ("full-legacy-reaudit","default_decision=case","requires_reaudit","clear_generic_legacy_block","confirm_reasoned_exclusion"):
    assert token in full_reaudit_sql, token
assert len(re.findall(r"\('legacy:\d+'", full_reaudit_sql)) == 791

print("GeoStats v16.2.6 legacy-rejection guard + complete 791-row re-audit checks passed.")
