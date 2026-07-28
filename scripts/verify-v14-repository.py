#!/usr/bin/env python3
from __future__ import annotations

import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

required = [
    ".github/workflows/repair-v14-expansion.yml",
    ".github/workflows/main.yml",
    "scripts/import-natural-earth.py",
    "scripts/import-world-bank-catalog.py",
    "scripts/import-comtrade.py",
    "scripts/verify-v14-import-expansion.py",
    "components/CategorySourcePanel.tsx",
    "supabase/migrations/020_transparency_playability_spatial_expansion.sql",
    "RUN_THIS_IN_SUPABASE_FOR_V14.sql",
    "RUN_THIS_IN_SUPABASE_FOR_V14_0_1.sql",
    "VERIFY_V14_0_1.sql",
]

missing = [path for path in required if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing required repository files:\n- " + "\n- ".join(missing))

package = json.loads((ROOT / "package.json").read_text())
version = (ROOT / "lib/version.ts").read_text()
if package.get("version") != "14.0.2" or 'APP_VERSION = "14.0.2"' not in version:
    raise SystemExit("Package and runtime versions are not both 14.0.2.")

for workflow_path in (ROOT / ".github/workflows").glob("*.yml"):
    text = workflow_path.read_text()
    if "actions/checkout@v7" in text or "actions/setup-python@v7" in text:
        raise SystemExit(f"Unsupported placeholder action version remains in {workflow_path.name}.")
    if "actions/checkout@" in text and "actions/checkout@v5" not in text:
        raise SystemExit(f"Unexpected checkout action version in {workflow_path.name}.")
    if "actions/setup-python@" in text and "actions/setup-python@v6" not in text:
        raise SystemExit(f"Unexpected setup-python action version in {workflow_path.name}.")

repair = (ROOT / ".github/workflows/repair-v14-expansion.yml").read_text()
for expected in (
    "name: Repair and expand v14 imports",
    "python scripts/import-natural-earth.py --minimum-successes 24",
    "--target-successes \"$TARGET\"",
    "python scripts/import-comtrade.py --minimum-successes 55",
    "python scripts/verify-v14-import-expansion.py",
):
    if expected not in repair:
        raise SystemExit(f"Repair workflow is missing: {expected}")


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
    raise SystemExit("Natural Earth importer does not define exactly 24 candidates.")
if tuple_size("scripts/import-comtrade.py", "SPECS") != 55:
    raise SystemExit("Comtrade importer does not define exactly 55 candidates.")

source_panel = (ROOT / "components/CategorySourcePanel.tsx").read_text()
for phrase in (
    "All available country values",
    "exact country snapshot GeoStats used",
    "Open exact query",
    "Download source data",
    "How GeoStats calculated it",
):
    if phrase not in source_panel:
        raise SystemExit(f"Source panel is missing expected behavior: {phrase}")

game = (ROOT / "components/GeoSecondComingGame.tsx").read_text()
if not re.search(r"<small>\{dataset\.category\.description\}</small>", game):
    raise SystemExit("Plain-language category descriptions are not displayed under category titles.")

print("Verified v14.0.2 repository structure, workflows, importer counts, source viewer, and descriptions.")
