#!/usr/bin/env python3
from __future__ import annotations

from data_pipeline.models import CandidateDefinition, IndicatorRule
from data_pipeline.semantics import classify_semantics


def candidate(key: str, title: str, family: str, code: str, description: str = "") -> CandidateDefinition:
    return CandidateDefinition(
        rule=IndicatorRule(
            key=key,
            title=title,
            description=description or title,
            family=family,
            icon="📊",
            unit="%",
            value_type="rate",
            ranking_direction="high",
            include=(title,),
        ),
        source_indicator_code=code,
        source_indicator_name=title,
        source_url="https://example.test",
        metadata={"source_query": {"indicator": code}},
    )

employment = classify_semantics("ilostat", candidate(
    "employment-population", "Highest employment-to-population ratio", "Labor", "EMP_2WAP_SEX_AGE_RT_A"
), "employment-population-ratio")
unemployment = classify_semantics("ilostat", candidate(
    "lowest-unemployment", "Lowest unemployment rate", "Labor", "UNE_2EAP_SEX_AGE_RT_A"
), "unemployment-rate")
assert employment.family == unemployment.family == "labor-market-utilization"

refugees = classify_semantics("unhcr", candidate(
    "most-refugees-originating", "Most refugees originating", "Displacement", "refugees-origin"
), "unhcr-refugees")
asylum = classify_semantics("unhcr", candidate(
    "most-asylum-applications-by-origin", "Most asylum applications by origin", "Displacement", "asylum-origin"
), "unhcr-applications")
assert refugees.family == asylum.family == "forced-displacement-origin"

cassava = classify_semantics("faostat", candidate(
    "cassava-yield", "Highest cassava yield", "Crops", "QCL:0125:5419", "Crop yield per hectare"
), "faostat-cassava-yield")
coconut = classify_semantics("faostat", candidate(
    "coconut-yield", "Highest coconut yield", "Crops", "QCL:0249:5419", "Crop yield per hectare"
), "faostat-coconut-yield")
assert cassava.family == coconut.family == "crop-yield"

productivity = classify_semantics("ilostat", candidate(
    "labor-productivity-growth", "Fastest labor-productivity growth", "Labor", "SDG_0811_SEX_AGE_RT_A"
), "labor-productivity-growth")
assert productivity.family == "labor-productivity"
assert productivity.family != employment.family

print("GeoStats v14.3 semantic classification tests passed.")
