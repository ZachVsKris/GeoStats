#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
migration = (ROOT / "supabase/migrations/019_trust_sources_auth_leaderboard.sql").read_text()
component = (ROOT / "components/GeoSecondComingGame.tsx").read_text()
source_panel = (ROOT / "components/CategorySourcePanel.tsx").read_text()
quality = (ROOT / "lib/categoryQuality.ts").read_text()
trust_audit = (ROOT / "CATEGORY_TRUST_REVIEW_V13_5.csv").read_text().splitlines()

required = [
    "credibility_status text",
    "comparability_risk text",
    "corroboration_status text",
    "IT.NET.USER.ZS",
    "IP.JRN.ARTC.SC",
    "WHS4_117",
    "WHS8_110",
    "WHS4_543",
    "longest-coastline",
    "username_customized",
]
for token in required:
    assert token in migration, token

assert 'trustStatus!=="quarantined"' in quality
assert "mostCommonShare" in quality
assert "Source & all data" in component and "CategorySourcePanel" in component
assert "exactQueryUrl" in source_panel and "downloadUrl" in source_panel and "methodologyUrl" in source_panel
assert "All available country values" in source_panel and "exact country snapshot" in source_panel
assert "Random tests are unranked" in component
assert len(trust_audit) == 242, f"expected 241 trust decisions, got {len(trust_audit)-1}"
assert "Longest coastline,Geography,longest-coastline,Natural Earth,90" in "\n".join(trust_audit)
assert "quarantined" in "\n".join(trust_audit)
print("v13.5 trust and runtime checks passed")
