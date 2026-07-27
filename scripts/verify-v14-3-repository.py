#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "supabase/migrations/023_semantic_board_quality.sql",
    "RUN_THIS_IN_SUPABASE_FOR_V14_3.sql",
    "VERIFY_V14_3.sql",
    "lib/categorySemantics.ts",
    "scripts/data_pipeline/semantics.py",
    "scripts/test-v14-3-semantics.py",
    "scripts/test-v14-3-integration.mjs",
    ".github/workflows/audit-source-integrity.yml",
    "START_HERE_V14_3.md",
    "RELEASE_NOTES_V14_3.md",
    "VALIDATION_V14_3.md",
    "EXPECTED_GITHUB_STRUCTURE_V14_3.txt",
    "FILE_MANIFEST_SHA256_V14_3.txt",
]
missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing v14.3 files: " + ", ".join(missing))
for path in REQUIRED:
    if (ROOT / path).stat().st_size == 0:
        raise SystemExit(f"Required file is empty: {path}")
package = json.loads((ROOT / "package.json").read_text())
if package.get("version") != "14.3.1":
    raise SystemExit("package.json version is not 14.3.1")
installer = (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V14_3.sql").read_text()
for marker in ("create table if not exists public.stat_validation_runs", "semantic_family", "board_semantic_conflicts", "category.validation_status='verified'", "boardWinnerGlobalRankLimit", "v14.3 source-integrity and semantic-quality audit"):
    if marker not in installer:
        raise SystemExit(f"Combined installer missing {marker}")
print("GeoStats v14.3 repository verification passed.")
