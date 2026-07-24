from __future__ import annotations

import json
from typing import Any, Iterable
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


class SupabaseWarehouse:
    def __init__(self, url: str, key: str, *, timeout: int = 120) -> None:
        self.base = url.rstrip("/")
        self.key = key
        self.timeout = timeout

    def _request(self, method: str, path: str, payload: Any = None, *, prefer: str | None = None) -> Any:
        body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        request = Request(f"{self.base}/rest/v1/{path}", data=body, method=method, headers=headers)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                return json.loads(raw.decode("utf-8")) if raw else None
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Supabase {method} {path} failed ({error.code}): {detail}") from error

    def create_import_run(self, source_organization: str, source_dataset: str, details: dict[str, Any]) -> int:
        rows = self._request(
            "POST",
            "stat_import_runs",
            [{
                "source_organization": source_organization,
                "source_dataset": source_dataset,
                "status": "running",
                "details": details,
            }],
            prefer="return=representation",
        )
        if not rows:
            raise RuntimeError("Supabase did not return the new import run.")
        return int(rows[0]["id"])

    def finish_import_run(self, run_id: int, **fields: Any) -> None:
        self._request("PATCH", f"stat_import_runs?id=eq.{run_id}", fields, prefer="return=minimal")

    def upsert_category(self, row: dict[str, Any]) -> None:
        self._request(
            "POST",
            "stat_categories?on_conflict=id",
            [row],
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def get_category_state(self, category_id: str) -> dict[str, Any] | None:
        rows = self._request(
            "GET",
            "stat_categories?"
            f"id=eq.{quote(category_id, safe='')}&"
            "select=review_status,enabled,eligible_daily",
        )
        if isinstance(rows, list) and rows:
            return dict(rows[0])
        return None

    def clear_category_observations(self, category_id: str) -> None:
        self._request("POST", "rpc/clear_stat_source_observations", {"p_category_id": category_id})

    def upsert_observations(self, rows: Iterable[dict[str, Any]], *, chunk_size: int = 500) -> int:
        chunk: list[dict[str, Any]] = []
        count = 0
        for row in rows:
            chunk.append(row)
            if len(chunk) >= chunk_size:
                self._upsert_observation_chunk(chunk)
                count += len(chunk)
                chunk = []
        if chunk:
            self._upsert_observation_chunk(chunk)
            count += len(chunk)
        return count

    def _upsert_observation_chunk(self, rows: list[dict[str, Any]]) -> None:
        self._request(
            "POST",
            "stat_observations?on_conflict=category_id,country_iso3,data_year",
            rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def link_canonical(self, payload: dict[str, Any]) -> str:
        rows = self._request("POST", "rpc/link_stat_category_to_canonical", payload)
        if isinstance(rows, str):
            return rows
        if isinstance(rows, list) and rows:
            return str(rows[0])
        return ""

    def mark_source_success(self, slug: str) -> None:
        self._request(
            "PATCH",
            f"data_sources?id=eq.{quote(slug)}",
            {"status": "active"},
            prefer="return=minimal",
        )
