from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import quote, unquote, urlparse

RAW_EXTENSION = re.compile(r"\.(?:csv|tsv|json|xml|zip|gz|gzip|xlsx?|parquet)(?:$|[?#])", re.I)
RAW_PATH = re.compile(r"/(?:api|bulk|download|downloads)(?:/|$)", re.I)
FORCED_DOWNLOAD_QUERY = re.compile(r"(?:^|[?&])(?:download|attachment)=", re.I)
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
    metadata = metadata or {}
    if source_slug == "worldbank":
        url = f"https://data.worldbank.org/indicator/{quote(indicator, safe='._-')}"
        return PlayerSourceAssessment(url, "exact", "Official World Bank indicator page.", 100)
    if source_slug == "unesco":
        url = str(metadata.get("source_page_url") or "")
        decoded = unquote(url).lower()
        parsed = urlparse(url)
        if human_readable_external_url(url) and parsed.hostname == "databrowser.uis.unesco.org" and parsed.path.startswith("/browser/") and indicator.lower() in decoded:
            return PlayerSourceAssessment(url, "pending", "Indicator-filtered UIS browser link awaits live HTML/deep-link validation.", 70)
    return PlayerSourceAssessment(None, "needs_exact_url", "No verified human-readable deep link to the exact filtered data is available.", 0)
