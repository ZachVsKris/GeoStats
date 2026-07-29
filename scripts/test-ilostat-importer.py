#!/usr/bin/env python3
import importlib.util
from pathlib import Path

path = Path(__file__).with_name("import-ilostat.py")
spec = importlib.util.spec_from_file_location("import_ilostat", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert len(module.RULES) >= 20
assert len({rule.key for rule in module.RULES}) == len(module.RULES)
rows = module._csv_rows("id,indicator.label,freq\nUNE_DEAP_SEX_AGE_RT_A,Unemployment rate by sex and age (%),A\n")
assert module._first(rows[0], "indicator.label") == "Unemployment rate by sex and age (%)"
nested = module._payload_rows(b'{"response":{"results":[{"id":"EMP_TEMP_SEX_AGE_NB_A"}]}}')
assert module._first(nested[0], "id") == "EMP_TEMP_SEX_AGE_NB_A"
fake = object.__new__(module.IlostatImporter)
unemployment = next(rule for rule in module.RULES if rule.key == "lowest-unemployment")
assert fake._match_score(unemployment, "Unemployment rate by sex and age (%) -- ILO modelled estimates", "UNE_DEAP_SEX_AGE_RT_A") is not None
assert fake._aggregate_row({"sex": "SEX_T", "classif1": "AGE_YTHADULT_YGE15", "best_source": "1"}, unemployment)
assert not fake._aggregate_row({"sex": "SEX_F", "classif1": "AGE_YTHADULT_YGE15", "best_source": "1"}, unemployment)
youth = next(rule for rule in module.RULES if rule.key == "lowest-youth-unemployment")
assert fake._aggregate_row({"sex": "SEX_T", "classif1": "AGE_YTHADULT_Y15-24", "best_source": "1"}, youth)
assert not fake._aggregate_row({"sex": "SEX_T", "classif1": "AGE_TOTAL", "best_source": "1"}, youth)
agriculture = next(rule for rule in module.RULES if rule.key == "highest-agricultural-employment")
assert fake._aggregate_row({"sex": "SEX_T", "classif1": "ECO_SECTOR_AGR", "best_source": "1"}, agriculture)
assert not fake._aggregate_row({"sex": "SEX_T", "classif1": "ECO_SECTOR_TOTAL", "best_source": "1"}, agriculture)
print("ILOSTAT importer tests passed.")
