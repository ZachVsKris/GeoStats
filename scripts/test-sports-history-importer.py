import importlib.util
import sys
import tempfile
from pathlib import Path

path = Path(__file__).with_name("import-sports-history.py")
spec = importlib.util.spec_from_file_location("sports_history", path)
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)

countries = [
    ("United States", 1930), ("Brazil", 1930), ("France", 1930), ("Mexico", 1930),
    ("Argentina", 1930), ("Chile", 1930), ("Uruguay", 1930), ("Belgium", 1930),
    ("Germany", 1934), ("Italy", 1934), ("Spain", 1934), ("Switzerland", 1934),
    ("Netherlands", 1934), ("Sweden", 1934), ("Norway", 1938), ("Portugal", 1966),
    ("South Korea", 1954), ("Japan", 1998), ("Canada", 1986), ("Australia", 1974),
]
with tempfile.TemporaryDirectory() as tmp:
    fifa = Path(tmp) / "fifa.csv"
    fifa.write_text("Team,Year\n" + "\n".join(f"{name},{year}" for name, year in countries) + "\nBrazil,1950\n", encoding="utf-8")
    imp = module.FIFAWorldCupImporter(None, str(fifa), dry_run=True)
    cand = imp.discover()[0]
    assert imp.values["BRA"] == 1930
    assert cand.metadata["eligible_universe_type"] == "defined_subset"
    assert cand.metadata["eligible_country_count"] == len(countries)
    assert cand.rule.ranking_direction == "low"
    assert imp.category_id(cand) == "sports:fifa-world-cup-first-appearance"

    ioc = Path(tmp) / "ioc.csv"
    olympic = [(name, 1896 + (i % 8) * 4) for i, (name, _) in enumerate(countries)]
    ioc.write_text("Country,Games Year\n" + "\n".join(f"{name},{year}" for name, year in olympic), encoding="utf-8")
    imp2 = module.IOCOlympicsImporter(None, str(ioc), dry_run=True)
    cand2 = imp2.discover()[0]
    assert cand2.metadata["eligible_universe_type"] == "defined_subset"
    assert cand2.rule.family == "Sports"
    assert imp2.category_id(cand2) == "sports:modern-olympics-first-appearance"

print("Sports history importer fixtures passed.")
