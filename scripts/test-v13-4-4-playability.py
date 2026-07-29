#!/usr/bin/env python3
from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
migration = (ROOT / "supabase/migrations/018_final_playability_calibration.sql").read_text()
run_sql = (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V13_4_4.sql").read_text()
verify = (ROOT / "VERIFY_V13_4_4.sql").read_text()

assert migration == run_sql
assert "geostats-v13.4.4-final-playability-v1" in migration
assert "create table if not exists public.stat_category_playability_rules" in migration
assert "minimum_common_year integer not null default 2022" in migration
assert "category_row.source_organization='ILOSTAT'" in migration
assert "extract(year from current_date)::integer-1" in migration
assert "country_leadership_self_report_only_allowed',false" in migration
assert "calibrated_category_not_playable" in verify

with (ROOT / "CURATION_DECISIONS_V13_4_4.csv").open(newline="") as handle:
    decisions = list(csv.DictReader(handle))
assert len(decisions) == 726
assert sum(row["decision"] == "approved" for row in decisions) == 241
assert sum(row["decision"] == "excluded" for row in decisions) == 485

with (ROOT / "PLAYABILITY_REVIEW_V13_4_4.csv").open(newline="") as handle:
    review = list(csv.DictReader(handle))
assert len(review) == 50
assert sum(row["final_decision"] == "calibrated_playable" for row in review) == 33
assert sum(row["final_decision"] == "excluded_after_final_review" for row in review) == 11
assert sum(row["final_decision"] == "temporarily_blocked_future_year" for row in review) == 5
assert sum(row["final_decision"] == "superseded_duplicate" for row in review) == 1

ilostat = (ROOT / "scripts/import-ilostat.py").read_text()
assert "completed_year = current_year - 1" in ilostat
assert "year > completed_year" in ilostat

print("v13.4.4 playability calibration checks passed")
