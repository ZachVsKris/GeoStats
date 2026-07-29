from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
failures: list[str] = []

def require(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)

version = (ROOT / "lib/version.ts").read_text()
require('APP_VERSION = "15.6.1"' in version, "App version was not advanced.")
require('RULES_VERSION = "12.2"' in version, "Rules version is not aligned to 12.2.")

routes = {
    "app/random/page.tsx": "normal",
    "app/random/easy/page.tsx": "easy",
    "app/random/scout/page.tsx": "easy",
    "app/random/normal/page.tsx": "normal",
    "app/random/adventurer/page.tsx": "normal",
    "app/random/expert/page.tsx": "expert",
}
for relative, difficulty in routes.items():
    path = ROOT / relative
    require(path.exists(), f"Missing Seeded route: {relative}")
    if path.exists():
        source = path.read_text()
        require('mode="random"' in source, f"{relative} does not enable Random mode.")
        require(f'initialDifficulty="{difficulty}"' in source, f"{relative} has the wrong difficulty.")

layout = (ROOT / "app/layout.tsx").read_text()
require('"./v15-6-1-corrective.css"' in layout, "Corrective CSS is not imported after globals.css.")

css = (ROOT / "app/v15-6-1-corrective.css").read_text()
require("-webkit-line-clamp: unset !important" in css, "Description line clamp was not removed.")
require("text-overflow: clip !important" in css, "Description ellipsis was not disabled.")
require("display: block !important" in css, "Hidden descriptions were not restored.")

sql = (ROOT / "RUN_THIS_IN_SUPABASE_FOR_V15_6_1.sql").read_text()
require(re.search(r"(?<!source_)indicator_code", sql) is None, "SQL references nonexistent indicator_code.")
for token in (
    "EN.URB.LCTY",
    "AG.LND.TOTL.K2",
    "EN.GHG.ALL.MT.CE.AR5",
    "EN.ATM.PM25.MC.M3",
    "travel services",
    "fruit primary",
):
    require(token.lower() in sql.lower(), f"SQL is missing agreed decision: {token}")

server_catalog = (ROOT / "lib/serverPlayableCatalog.ts").read_text()
require("v15.6.1" in server_catalog, "Server catalog cache keys were not advanced.")

if failures:
    print("v15.6.1 corrective checks FAILED:")
    for failure in failures:
        print(f" - {failure}")
    sys.exit(1)

print("v15.6.1 corrective static checks passed.")
