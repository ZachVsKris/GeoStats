#!/usr/bin/env python3
from __future__ import annotations

import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    ".github/workflows/repair-v14-expansion.yml",
    "GITHUB_ACTIONS_WORKFLOWS/repair-v14-expansion.yml",
    "lib/continents.ts",
    "lib/analytics.ts",
    "components/AnalyticsPageView.tsx",
    "components/CategorySourcePanel.tsx",
    "app/api/analytics/events/route.ts",
    "supabase/migrations/021_analytics_generation_health.sql",
    "RUN_THIS_IN_SUPABASE_FOR_V14_1.sql",
    "VERIFY_V14_1.sql",
    "START_HERE_V14_1.md",
    "RELEASE_NOTES_V14_1.md",
    "VALIDATION_V14_1.md",
    ".github/workflows/import-comtrade.yml",
    ".github/workflows/main.yml",
]
missing = [path for path in REQUIRED if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing v14.1 files:\n- " + "\n- ".join(missing))


if (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V14_1.sql").read_bytes() != (ROOT / "supabase/migrations/021_analytics_generation_health.sql").read_bytes():
    raise SystemExit("The deployable v14.1 SQL does not exactly match migration 021.")

package = json.loads((ROOT / "package.json").read_text())
version = (ROOT / "lib/version.ts").read_text()
if package.get("version") not in {"14.1.0", "14.2.0"} or not any(f'APP_VERSION = "{value}"' in version for value in ("14.1.0", "14.2.0")):
    raise SystemExit("Package and runtime versions are not a supported v14.1+ release.")


def tuple_size(path: str, variable: str) -> int:
    module = ast.parse((ROOT / path).read_text())
    for node in module.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.target.id == variable:
            if isinstance(node.value, (ast.Tuple, ast.List)):
                return len(node.value.elts)
        if isinstance(node, ast.Assign):
            if any(isinstance(target, ast.Name) and target.id == variable for target in node.targets):
                if isinstance(node.value, (ast.Tuple, ast.List)):
                    return len(node.value.elts)
    raise SystemExit(f"Could not find {variable} in {path}.")

if tuple_size("scripts/import-natural-earth.py", "RULES") != 24:
    raise SystemExit("Natural Earth importer must define exactly 24 candidates.")
if tuple_size("scripts/import-comtrade.py", "SPECS") != 55:
    raise SystemExit("UN Comtrade importer must define exactly 55 candidates.")

repair = (ROOT / ".github/workflows/repair-v14-expansion.yml").read_text()
for expected in (
    "python scripts/import-natural-earth.py --minimum-successes 24",
    "python scripts/import-comtrade.py --minimum-successes 0",
    "--comtrade-target-total 55",
):
    if expected not in repair:
        raise SystemExit(f"Repair workflow is missing: {expected}")

for workflow_path in (".github/workflows/import-comtrade.yml", ".github/workflows/main.yml"):
    workflow_text = (ROOT / workflow_path).read_text()
    if "python scripts/import-comtrade.py --minimum-successes 0" not in workflow_text:
        raise SystemExit(f"{workflow_path} does not preserve resumable Comtrade partial success.")

source_panel = (ROOT / "components/CategorySourcePanel.tsx").read_text()
for expected in ("Global rankings", "Look up a country", "View source material"):
    if expected not in source_panel:
        raise SystemExit(f"Simplified source panel is missing: {expected}")
for forbidden in ("Verifiability", "Why this category is usable", "Exact stored query parameters"):
    if forbidden in source_panel:
        raise SystemExit(f"Player source panel still exposes internal validation detail: {forbidden}")

rules = (ROOT / "lib/gameRules.ts").read_text()
for expected in ("maxFaostatCategories", "maxCountriesPerContinent", "strongestGlobalWinnerRank"):
    if expected not in rules:
        raise SystemExit(f"Generation rules are missing: {expected}")

print("Verified GeoStats v14.1 repository structure and release-critical behavior.")
