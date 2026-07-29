#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "supabase/migrations/024_content_comprehension_and_player_links.sql",
    "RUN_THIS_IN_SUPABASE_FOR_V14_3_1.sql",
    "VERIFY_V14_3_1.sql",
    "CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv",
    "CONTENT_SOURCE_REVIEW_V14_3_1.md",
    "lib/playerSourceLinks.ts",
    "scripts/data_pipeline/player_source_links.py",
    "scripts/audit-player-source-links.py",
    "scripts/test-player-source-links.py",
    "scripts/test-v14-3-1-content-links.py",
    "scripts/test-v14-3-1-integration.mjs",
    ".github/workflows/audit-player-source-links.yml",
    "START_HERE_V14_3_1.md",
    "RELEASE_NOTES_V14_3_1.md",
    "VALIDATION_V14_3_1.md",
    "EXPECTED_GITHUB_STRUCTURE_V14_3_1.txt",
    "FILE_MANIFEST_SHA256_V14_3_1.txt",
]
missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing v14.3.1 files: " + ", ".join(missing))
for relative in REQUIRED:
    if (ROOT / relative).stat().st_size == 0:
        raise SystemExit(f"Required file is empty: {relative}")

manifest_path = ROOT / "FILE_MANIFEST_SHA256_V14_3_1.txt"
manifest_entries: dict[str, str] = {}
for line_number, line in enumerate(manifest_path.read_text(encoding="utf-8").splitlines(), 1):
    if not line.strip():
        continue
    try:
        expected_hash, relative = line.split("  ", 1)
    except ValueError as error:
        raise SystemExit(f"Malformed manifest line {line_number}") from error
    if relative == manifest_path.name:
        raise SystemExit("Manifest must not include itself")
    target = ROOT / relative
    if not target.is_file():
        raise SystemExit(f"Manifest file is missing: {relative}")
    actual_hash = hashlib.sha256(target.read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        raise SystemExit(f"Manifest checksum mismatch: {relative}")
    manifest_entries[relative] = expected_hash
if len(manifest_entries) < 250:
    raise SystemExit(f"Manifest contains only {len(manifest_entries)} files")
for relative in REQUIRED:
    if relative != manifest_path.name and relative not in manifest_entries:
        raise SystemExit(f"Required file absent from manifest: {relative}")

package = json.loads((ROOT / "package.json").read_text())
if package.get("version") != "14.3.1":
    raise SystemExit("package.json version is not 14.3.1")

rows = list(csv.DictReader((ROOT / "CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv").open(encoding="utf-8")))
if len(rows) != 726:
    raise SystemExit(f"Content review has {len(rows)} rows, expected 726")
keys = [(row["source_organization"], row["source_indicator_code"], row["previous_title"]) for row in rows]
if len(set(keys)) != len(keys):
    raise SystemExit("Content review contains duplicate source/code/title decisions")
if sum(row["content_decision"] == "approved" for row in rows) != 243:
    raise SystemExit("Content review approval count is not 243")
if sum(row["content_decision"] == "excluded" for row in rows) != 483:
    raise SystemExit("Content review exclusion count is not 483")

installer = (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V14_3_1.sql").read_text()
for marker in (
    "create table if not exists public.stat_validation_runs",
    "board_semantic_conflicts",
    "add column if not exists player_source_url",
    "add column if not exists content_review_status",
    "player_source_url_is_safe",
    "stat_categories_content_player_link_gate",
    "category_content_link_overview",
    "EMP_2WAP_SEX_AGE_RT_A",
    "SDG_1041_NOC_RT_A",
    "GDP_205U_NOC_NB_A",
):
    if marker not in installer:
        raise SystemExit(f"Combined installer missing {marker}")
if installer.count("\n  ('") < 726:
    raise SystemExit("Combined installer does not contain the full 726-row review")

version = (ROOT / "lib/version.ts").read_text()
for marker in ('APP_VERSION = "14.3.1"', 'RULES_VERSION = "8.1"', "CONTENT-LINK"):
    if marker not in version:
        raise SystemExit(f"Version file missing {marker}")

print("GeoStats v14.3.1 repository verification passed.")
