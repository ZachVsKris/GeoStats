from __future__ import annotations

import re
from dataclasses import dataclass

from .models import CandidateDefinition


@dataclass(frozen=True)
class SemanticProfile:
    family: str
    topic: str


def _slug(value: str) -> str:
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", value.lower()))


def classify_semantics(source_slug: str, candidate: CandidateDefinition, concept_group: str) -> SemanticProfile:
    text = _slug(" ".join([
        candidate.rule.key,
        candidate.rule.title,
        candidate.rule.description,
        candidate.rule.family,
        candidate.source_indicator_code,
        candidate.source_indicator_name,
    ]))
    topic = _slug(concept_group or candidate.rule.key)

    if source_slug == "pewreligion":
        return SemanticProfile(str(candidate.metadata.get("strategyFamily") or "religious-composition"), topic)
    if source_slug == "faostatfbs":
        return SemanticProfile("food-consumption", topic)
    if source_slug == "worldbankexpansion":
        return SemanticProfile(str(candidate.metadata.get("strategyFamily") or topic), topic)
    if source_slug == "smithsoniangvp":
        return SemanticProfile("volcanic-geography", topic)
    if source_slug == "usgs":
        return SemanticProfile("seismic-activity", topic)
    if source_slug == "worldcover":
        return SemanticProfile("land-cover", topic)
    if source_slug == "hydrosheds":
        return SemanticProfile("hydrography", topic)
    if source_slug == "elevation":
        return SemanticProfile("terrain-elevation", topic)
    if source_slug == "unescoheritage":
        return SemanticProfile("world-heritage", topic)
    if source_slug == "aquastat":
        return SemanticProfile("water-resources", topic)
    if source_slug == "usgsminerals":
        return SemanticProfile("mineral-production", topic)
    if source_slug == "faofisheries":
        return SemanticProfile("fisheries-production", topic)

    if source_slug in {"unmembership", "constitute"}:
        return SemanticProfile("historical-state-institutions", topic)

    if source_slug == "unhcr" or re.search(r"refugee|asylum|displacement", text):
        if re.search(r"origin|originating|by-origin", text):
            return SemanticProfile("forced-displacement-origin", topic)
        if re.search(r"hosted|received|destination|receiving", text):
            return SemanticProfile("forced-displacement-destination", topic)
        return SemanticProfile("forced-displacement", topic)

    if re.search(r"employment-to-population|employment-population|unemployment|labor-force-participation|labour-force-participation", text):
        return SemanticProfile("labor-market-utilization", topic)
    if re.search(r"labor-productivity|labour-productivity|productivity-growth", text):
        return SemanticProfile("labor-productivity", topic)
    if re.search(r"self-employment|wage-employment|employment-status", text):
        return SemanticProfile("employment-status", topic)

    if source_slug == "faostat":
        if re.search(r"(^|-)yield($|-)", text):
            return SemanticProfile("crop-yield", topic)
        if re.search(r"(^|-)production($|-)", text):
            return SemanticProfile("crop-production", topic)
        if re.search(r"area-harvested|harvested-area", text):
            return SemanticProfile("crop-harvested-area", topic)

    if re.search(r"gdp|gross-domestic-product|economic-output", text):
        return SemanticProfile("economic-output", topic)
    if re.search(r"forest-area|forest-cover|forest-percent|forest-share|least-forest", text):
        return SemanticProfile("forest-cover", topic)
    if re.search(r"urban-population|rural-population|urbanization|settlement-share", text):
        return SemanticProfile("settlement-share", topic)
    if "life-expectancy" in text:
        return SemanticProfile("life-expectancy", topic)
    if "infant-mortality" in text:
        return SemanticProfile("infant-mortality", topic)
    if "maternal-mortality" in text:
        return SemanticProfile("maternal-mortality", topic)
    if re.search(r"vaccination|immunization|measles-vaccine", text):
        return SemanticProfile("immunization-coverage", topic)
    if re.search(r"merchandise-export|general-export|exports-share", text):
        return SemanticProfile("general-exports", topic)
    if re.search(r"merchandise-import|general-import", text):
        return SemanticProfile("general-imports", topic)

    return SemanticProfile(topic, topic)
