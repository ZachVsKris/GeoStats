from __future__ import annotations

import json
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen


class JsonHttpClient:
    def __init__(self, *, timeout: int = 90, retries: int = 4, user_agent: str = "GeoStats/13.0") -> None:
        self.timeout = timeout
        self.retries = retries
        self.user_agent = user_agent

    def get_json(self, url: str) -> Any:
        last_error: Exception | None = None
        for attempt in range(self.retries):
            request = Request(url, headers={"Accept": "application/json", "User-Agent": self.user_agent})
            try:
                with urlopen(request, timeout=self.timeout) as response:
                    return json.loads(response.read().decode("utf-8"))
            except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
                last_error = error
                if attempt + 1 >= self.retries:
                    break
                time.sleep(2 ** attempt)
        raise RuntimeError(f"Could not retrieve JSON from {url}: {last_error}")

    def get_odata(self, url: str, *, max_pages: int = 200) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        next_url: str | None = url
        pages = 0
        while next_url:
            pages += 1
            if pages > max_pages:
                raise RuntimeError(f"OData pagination exceeded {max_pages} pages for {url}")
            payload = self.get_json(next_url)
            if not isinstance(payload, dict):
                raise RuntimeError(f"Unexpected OData response from {next_url}")
            value = payload.get("value")
            if not isinstance(value, list):
                raise RuntimeError(f"OData response did not contain a value array: {next_url}")
            rows.extend(row for row in value if isinstance(row, dict))
            candidate_next = payload.get("@odata.nextLink") or payload.get("odata.nextLink")
            next_url = urljoin(next_url, str(candidate_next)) if candidate_next else None
        return rows
