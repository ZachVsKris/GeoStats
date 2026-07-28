#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
required = [
    ".github/workflows/audit-source-integrity.yml",
    "GITHUB_ACTIONS_WORKFLOWS/audit-source-integrity.yml",
    "supabase/migrations/022_source_integrity_validation.sql",
    "RUN_THIS_IN_SUPABASE_FOR_V14_2.sql",
    "VERIFY_V14_2.sql",
    "EXPECTED_GITHUB_STRUCTURE_V14_2.txt",
    "FILE_MANIFEST_SHA256_V14_2.txt",
    "scripts/data_pipeline/integrity.py",
    "scripts/audit-source-integrity.py",
    "scripts/activate-source-integrity.py",
    "scripts/test-source-integrity.py",
    "scripts/test-v14-2-integration.mjs",
    "components/CategorySourcePanel.tsx",
]
missing = [path for path in required if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing v14.2 files: " + ", ".join(missing))
package = json.loads((ROOT / "package.json").read_text())
if package.get("version") != "14.2.0":
    raise SystemExit("package.json version is not 14.2.0")

installer = (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V14_2.sql").read_text()
for marker in ("create table if not exists public.analytics_events", "create table if not exists public.stat_validation_runs", "activate_source_integrity_enforcement"):
    if marker not in installer:
        raise SystemExit(f"Combined Supabase installer is missing: {marker}")
workflow = (ROOT / ".github/workflows/audit-source-integrity.yml").read_text()
backup = (ROOT / "GITHUB_ACTIONS_WORKFLOWS/audit-source-integrity.yml").read_text()
if workflow != backup:
    raise SystemExit("Visible workflow backup does not match .github workflow")

server_catalog = (ROOT / "lib/serverPlayableCatalog.ts").read_text()
browser_catalog = (ROOT / "lib/playableCatalog.ts").read_text()
if "verified v14.2 category catalog is unavailable" not in server_catalog:
    raise SystemExit("Server catalog is not explicitly fail-closed")
if "return built.length ? built : CATEGORIES" in server_catalog or ".catch(() => CATEGORIES.filter" in browser_catalog:
    raise SystemExit("Unverified static gameplay fallback is still present")

for path in required:
    if (ROOT / path).stat().st_size == 0:
        raise SystemExit(f"Required file is empty: {path}")
print("GeoStats v14.2 repository verification passed.")
