#!/usr/bin/env python3
from data_pipeline.canonical_countries import CANONICAL_COUNTRY_NAMES, canonical_country_name
from data_pipeline.governance import GOVERNANCE_VERSION, evaluate_governance
from data_pipeline.models import CandidateDefinition, IndicatorRule, QualityResult

assert len(CANONICAL_COUNTRY_NAMES) == 195
assert canonical_country_name("COD") == "Democratic Republic of the Congo"
assert canonical_country_name("COG") == "Republic of the Congo"
assert canonical_country_name("TUR") == "Türkiye"
assert canonical_country_name("PSE") == "Palestine"

rule = IndicatorRule(
    key="highest-life-expectancy",
    title="Highest life expectancy",
    description="test",
    family="Health",
    icon="❤️",
    unit="years",
    value_type="other",
    ranking_direction="high",
    include=(),
    evidence_tier="A",
    source_priority=10,
)
candidate = CandidateDefinition(rule, "TEST", "Test", "https://example.test")
quality = QualityResult(95, "needs_review", True, 2025, 180, 2025, 190, 1.0, 0.0, 95, 95, "A", "test")
decision = evaluate_governance("who", candidate, quality)
assert decision.auto_approved
assert decision.provenance_status == "approved"
assert decision.concept_group == "life-expectancy"
assert decision.source_priority == 10

for key, expected_group in [
    ("highest-safe-drinking-water", "drinking-water-access"),
    ("highest-wage-employment-share", "employment-status-share"),
    ("highest-self-employment-share", "employment-status-share"),
]:
    alias_rule = IndicatorRule(
        key=key, title=key, description="test", family="Test", icon="•", unit="%",
        value_type="percentage", ranking_direction="high", include=(), evidence_tier="A",
    )
    alias_decision = evaluate_governance("who" if "drinking" in key else "ilostat", CandidateDefinition(alias_rule, key, key, "https://example.test"), quality)
    assert alias_decision.concept_group == expected_group

blocked_rule = IndicatorRule(
    key="highest-birth-registration",
    title="Highest birth registration",
    description="test",
    family="Health",
    icon="📄",
    unit="%",
    value_type="percentage",
    ranking_direction="high",
    include=(),
    evidence_tier="A",
)
blocked = evaluate_governance("who", CandidateDefinition(blocked_rule, "TEST2", "Test 2", "https://example.test"), quality)
assert not blocked.auto_approved
assert blocked.provenance_status == "blocked"
assert GOVERNANCE_VERSION == "geostats-v13.4-provenance-v1"
print("GeoStats v13.4 governance tests passed.")
