#!/usr/bin/env python3
from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
rows = list(csv.DictReader((ROOT / "CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv").open(encoding="utf-8")))
assert len(rows) == 726
counts = Counter(row["content_decision"] for row in rows)
assert counts == {"excluded": 483, "approved": 243}, counts
assert Counter(row["player_link_status"] for row in rows) == {
    "not_applicable": 483,
    "needs_exact_url": 192,
    "unavailable": 6,
    "exact": 45,
}

by_key = {(row["source_organization"], row["source_indicator_code"]): row for row in rows}
for source, code in (
    ("ILOSTAT", "EMP_2WAP_SEX_AGE_RT_A"),
    ("ILOSTAT", "SDG_1041_NOC_RT_A"),
    ("ILOSTAT", "GDP_205U_NOC_NB_A"),
    ("ILOSTAT", "SDG_0821_NOC_RT_A"),
    ("World Bank", "NV.IND.TOTL.ZS"),
    ("World Bank", "NE.GDI.TOTL.ZS"),
    ("World Bank", "NY.GNS.ICTR.ZS"),
):
    assert by_key[(source, code)]["content_decision"] == "excluded"

assert by_key[("World Bank", "SP.POP.65UP.TO.ZS")]["player_title"] == "Highest share of people age 65+"
assert by_key[("UNHCR", "population:coo:refugees")]["player_title"] == "Most refugees by country of origin"
assert by_key[("WHO", "MALARIA_EST_INCIDENCE")]["player_title"] == "Fewest new malaria cases per person"

migration = (ROOT / "supabase/migrations/024_content_comprehension_and_player_links.sql").read_text(encoding="utf-8")
assert migration.count("\n  ('") == 726
for token in (
    "player_source_url_is_safe",
    "stat_categories_content_player_link_gate",
    "category_content_link_overview",
    "category_content_link_issues",
    "content_review_status='approved' and player_source_status='exact'",
    "https://data.worldbank.org/indicator/",
):
    assert token in migration, token

player_pages = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in (
    "components/CategorySourcePanel.tsx",
    "app/data/page.tsx",
    "app/audit/page.tsx",
))
assert player_pages.count("resolvePlayerSourceUrl") >= 3
assert player_pages.count("View exact official data") >= 3
for forbidden in (
    "exactQueryUrl ?? category.downloadUrl",
    "exactQueryUrl || downloadUrl",
    "Best available source link",
    "href={fullDataset.exactQueryUrl",
    "href={fullDataset.downloadUrl",
    "category.sourceUrl ?? categorySourceUrl",
):
    assert forbidden not in player_pages, forbidden
assert "where source_organization<>'World Bank'" in migration
assert "where source_organization not in ('World Bank','UNESCO UIS')" not in migration

catalog = ((ROOT / "lib/playableCatalog.ts").read_text() + (ROOT / "lib/serverPlayableCatalog.ts").read_text())
for token in (
    'content_review_status !== "approved"',
    'player_source_status !== "exact"',
    'immediate_comprehension_score',
    'gameplay_interest_score',
    'link_quality_score',
):
    assert token in catalog, token

base = (ROOT / "scripts/data_pipeline/base.py").read_text()
assert "Content/editorial decisions and audited player links are durable" in base
assert 'existing.get("content_review_status")' in base
assert 'existing.get("player_source_status")' in base

print("GeoStats v14.3.1 content review and exact player-link gate tests passed.")
