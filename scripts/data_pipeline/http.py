from __future__ import annotations

import gzip
import io
import json
import random
import time
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen


def _safe_url(url: str) -> str:
    """Redact API credentials before URLs reach logs or warehouse error details."""
    try:
        parts = urlsplit(url)
        secret_keys = {"subscription-key", "api_key", "apikey", "key", "token", "access_token"}
        query = [(key, "***" if key.lower() in secret_keys else value) for key, value in parse_qsl(parts.query, keep_blank_values=True)]
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
    except Exception:
        return url


class HttpStatusError(RuntimeError):
    def __init__(self, url: str, status: int, message: str, *, retry_after: float | None = None) -> None:
        safe_url = _safe_url(url)
        super().__init__(f"Could not retrieve {safe_url}: HTTP Error {status}: {message}")
        self.url = safe_url
        self.status = status
        self.retry_after = retry_after


def _retry_after_seconds(error: HTTPError) -> float | None:
    raw = error.headers.get("Retry-After") if error.headers else None
    if not raw:
        return None
    try:
        return max(0.0, float(raw))
    except (TypeError, ValueError):
        try:
            return max(0.0, parsedate_to_datetime(raw).timestamp() - time.time())
        except Exception:
            return None


class HttpClient:
    """Small retrying client shared by JSON, CSV, and archive importers."""

    def __init__(self, *, timeout: int = 120, retries: int = 5, user_agent: str = "GeoStats/14.1") -> None:
        self.timeout = timeout
        self.retries = retries
        self.user_agent = user_agent

    def get_bytes(self, url: str, *, accept: str = "*/*") -> bytes:
        last_error: Exception | None = None
        for attempt in range(self.retries):
            request = Request(url, headers={"Accept": accept, "User-Agent": self.user_agent})
            try:
                with urlopen(request, timeout=self.timeout) as response:
                    payload = response.read()
                    encoding = str(response.headers.get("Content-Encoding") or "").lower()
                    content_type = str(response.headers.get("Content-Type") or "").lower()
                    if encoding == "gzip" or payload[:2] == b"\x1f\x8b" or "application/gzip" in content_type:
                        return gzip.decompress(payload)
                    return payload
            except HTTPError as error:
                detail = error.read().decode("utf-8", errors="replace").strip() or str(error.reason or "HTTP request failed")
                retry_after = _retry_after_seconds(error)
                status_error = HttpStatusError(url, int(error.code), detail[:500], retry_after=retry_after)
                last_error = status_error
                retryable = error.code == 429 or 500 <= error.code < 600
                if not retryable or attempt + 1 >= self.retries:
                    raise status_error from error
                delay = retry_after if retry_after is not None else min(90.0, (2 ** attempt) * 3.0 + random.random())
                print(f"HTTP {error.code}; retrying in {delay:.1f}s…", flush=True)
                time.sleep(delay)
            except (URLError, TimeoutError, OSError) as error:
                last_error = error
                if attempt + 1 >= self.retries:
                    break
                time.sleep(min(30, 2 ** attempt))
        raise RuntimeError(f"Could not retrieve {_safe_url(url)}: {last_error}")

    def get_text(self, url: str, *, accept: str = "text/plain,*/*") -> str:
        return self.get_bytes(url, accept=accept).decode("utf-8-sig", errors="replace")

    def get_json(self, url: str) -> Any:
        raw = self.get_bytes(url, accept="application/json")
        try:
            return json.loads(raw.decode("utf-8-sig"))
        except json.JSONDecodeError as error:
            preview = raw[:300].decode("utf-8", errors="replace")
            raise RuntimeError(f"Could not parse JSON from {url}: {preview}") from error


class JsonHttpClient(HttpClient):
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
