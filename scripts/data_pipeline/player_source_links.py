from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import quote, unquote, urlparse

RAW_EXTENSION = re.compile(r"\.(?:csv|tsv|json|xml|zip|gz|gzip|xlsx?|parquet)(?:$|[?#])", re.I)
RAW_PATH = re.compile(r"/(?:api|bulk|download|downloads)(?:/|$)", re.I)
FORCED_DOWNLOAD_QUERY = re.compile(r"(?:^|[?&])(?:download|attachment)=", re.I)

GENERAL_OFFICIAL_SOURCE_PAGES = {
    "faostatfbs": "https://www.fao.org/faostat/en/#data/FBS",
    "faostat": "https://www.fao.org/faostat/en/",
    "who": "https://www.who.int/data/gho/data",
    "unesco": "https://databrowser.uis.unesco.org/",
    "ilostat": "https://ilostat.ilo.org/data/",
    "naturalearth": "https://www.naturalearthdata.com/",
    "comtrade": "https://comtradeplus.un.org/",
    "eia": "https://www.eia.gov/international/data/world",
    "unhcr": "https://www.unhcr.org/refugee-statistics/",
    "untourism": "https://www.unwto.org/tourism-statistics",
    "pewreligion": "https://www.pewresearch.org/religion/feature/religious-composition-by-country-2010-2020/",
    "smithsoniangvp": "https://volcano.si.edu/volcanolist_holocene.cfm",
    "usgs": "https://earthquake.usgs.gov/earthquakes/search/",
    "worldcover": "https://esa-worldcover.org/en/data-access",
    "hydrosheds": "https://www.hydrosheds.org/products",
    "elevation": "https://www.gebco.net/data-products/gridded-bathymetry-data",
    "unescoheritage": "https://whc.unesco.org/en/list/",
    "aquastat": "https://www.fao.org/aquastat/en/databases/maindatabase/",
    "usgsminerals": "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries",
    "faofisheries": "https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en",
    "unmembership": "https://www.un.org/about-us/member-states",
    "constitute": "https://www.constituteproject.org/constitutions",
    "ipu": "https://data.ipu.org/compare/",
    "unwpp": "https://population.un.org/wpp/",
    "worldbankclimate": "https://climateknowledgeportal.worldbank.org/",
    "imfweo": "https://www.imf.org/en/Publications/WEO/weo-database/2026/April",
    "unescoich": "https://data.unesco.org/",
    "noaatsunami": "https://www.ncei.noaa.gov/products/natural-hazards/tsunamis-earthquakes-volcanoes/tsunamis",
    "whoghed": "https://apps.who.int/nha/database/",
    "undesamigrant": "https://www.un.org/development/desa/pd/content/international-migrant-stock",
    "wtoservices": "https://data.wto.org/en/dataset/comservices",
    "untourismdirect": "https://www.unwto.org/tourism-data/country-profile-inbound-tourism",
}

RAW_QUERY = re.compile(r"(?:^|[?&])(?:format|download|output|type)=(?:csv|tsv|json|xml|zip|xlsx?|parquet)(?:&|$)", re.I)


@dataclass(frozen=True)
class PlayerSourceAssessment:
    url: str | None
    status: str
    reason: str
    score: int


def human_readable_external_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        return False
    if parsed.hostname and (parsed.hostname.startswith("api.") or parsed.hostname.startswith("comtradeapi.")):
        return False
    complete = f"{parsed.path}?{parsed.query}#{parsed.fragment}"
    return not RAW_EXTENSION.search(complete) and not RAW_PATH.search(parsed.path) and not RAW_QUERY.search(parsed.query) and not FORCED_DOWNLOAD_QUERY.search(parsed.query)


def exact_url_for(source_slug: str, indicator: str, metadata: dict | None = None) -> PlayerSourceAssessment:
    """Return an exact official page when possible, otherwise a safe general page.

    v14.4 deliberately separates source-link precision from data trust. A
    machine-readable API/download is never player-facing, but a general official
    source page is acceptable when the provider cannot expose a stable deep link.
    """
    metadata = metadata or {}
    if source_slug in {"worldbank", "worldbankexpansion"}:
        primary_indicator = indicator.split("/", 1)[0]
        url = f"https://data.worldbank.org/indicator/{quote(primary_indicator, safe='._-')}"
        return PlayerSourceAssessment(url, "exact", "Official World Bank indicator page.", 100)

    if source_slug == "unesco":
        url = str(metadata.get("source_page_url") or "")
        decoded = unquote(url).lower()
        parsed = urlparse(url)
        if human_readable_external_url(url) and parsed.hostname == "databrowser.uis.unesco.org" and parsed.path.startswith("/browser/") and indicator.lower() in decoded:
            return PlayerSourceAssessment(url, "exact", "Official UIS Data Browser link identifies the indicator.", 100)

    for key in ("source_page_url", "source_url", "methodology_url"):
        value = str(metadata.get(key) or "").strip()
        if human_readable_external_url(value):
            return PlayerSourceAssessment(
                value,
                "general",
                "Official human-readable source page; the provider does not expose a stable exact data-view link.",
                70,
            )

    fallback = GENERAL_OFFICIAL_SOURCE_PAGES.get(source_slug)
    if human_readable_external_url(fallback):
        return PlayerSourceAssessment(
            fallback,
            "general",
            "General official data portal; the provider does not expose a stable exact data-view link.",
            70,
        )

    return PlayerSourceAssessment(None, "unavailable", "No safe human-readable official source page is available.", 0)
