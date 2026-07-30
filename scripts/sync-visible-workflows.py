#!/usr/bin/env python3
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
source = root / ".github" / "workflows"
target = root / "GITHUB_ACTIONS" / "workflows"
if not source.is_dir():
    raise SystemExit("Missing .github/workflows")
if target.exists():
    shutil.rmtree(target)
shutil.copytree(source, target)
print(f"Copied {len(list(target.glob('*.yml'))) + len(list(target.glob('*.yaml')))} workflows to {target.relative_to(root)}")
