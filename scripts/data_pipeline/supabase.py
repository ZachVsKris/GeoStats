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

    def list_source_indicator_codes(self, source_organization: str) -> set[str]:
        rows = self._request(
            "GET",
            "stat_categories?"
            f"source_organization=eq.{quote(source_organization, safe='')}&"
            "select=source_indicator_code&limit=10000",
        )
        return {
            str(row.get("source_indicator_code"))
            for row in (rows if isinstance(rows, list) else [])
            if isinstance(row, dict) and row.get("source_indicator_code") not in (None, "")
        }

    def get_category_state(self, category_id: str) -> dict[str, Any] | None:
        rows = self._request(
            "GET",
            "stat_categories?"
            f"id=eq.{quote(category_id, safe='')}&"
            "select=review_status,enabled,eligible_daily,content_review_status,content_review_reason,content_review_version,immediate_comprehension_score,gameplay_interest_score,uniqueness_score,player_source_url,player_source_status,player_source_reason,player_source_checked_at,link_quality_score",
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


    def apply_category_governance(self, category_id: str) -> None:
        self._request("POST", "rpc/apply_category_governance", {"p_category_id": category_id})


    def get_category_integrity_state(self, category_id: str) -> dict[str, Any] | None:
        rows = self._request(
            "GET",
            "stat_categories?"
            f"id=eq.{quote(category_id, safe='')}&"
            "select=*",
        )
        if isinstance(rows, list) and rows:
            return dict(rows[0])
        return None

    def get_category_observations(self, category_id: str, year: int) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "stat_observations?"
            f"category_id=eq.{quote(category_id, safe='')}&data_year=eq.{int(year)}&"
            "select=country_iso3,country_name,data_year,value,source_url,source_record_id,metadata&limit=1000",
        )
        return [dict(row) for row in rows] if isinstance(rows, list) else []

    def record_category_validation(self, category_id: str, result: Any, *, run_id: int | None = None) -> None:
        self._request("POST", "rpc/record_category_validation", result.rpc_payload(category_id, run_id=run_id))

    def create_validation_run(self, source_organization: str | None, validation_version: str, details: dict[str, Any]) -> int:
        rows = self._request(
            "POST",
            "stat_validation_runs",
            [{
                "source_organization": source_organization,
                "status": "running",
                "validation_version": validation_version,
                "details": details,
            }],
            prefer="return=representation",
        )
        if not rows:
            raise RuntimeError("Supabase did not return the new validation run.")
        return int(rows[0]["id"])

    def finish_validation_run(self, run_id: int, **fields: Any) -> None:
        self._request("PATCH", f"stat_validation_runs?id=eq.{run_id}", fields, prefer="return=minimal")

    def list_categories_for_validation(self, *, source_organization: str | None = None, playable_only: bool = True) -> list[dict[str, Any]]:
        filters = []
        if source_organization:
            filters.append(f"source_organization=eq.{quote(source_organization, safe='')}")
        suffix = "&".join(filters)
        if suffix:
            suffix += "&"
        rows = self._request(
            "GET",
            "stat_categories?" + suffix + "select=*&order=source_organization.asc,title.asc&limit=5000",
        )
        result = [dict(row) for row in rows] if isinstance(rows, list) else []
        if playable_only:
            # Include categories that are currently playable or retain an approved
            # editorial/curation decision. Failed audits deliberately disable and
            # demote rows, but those curated rows must remain selectable for repair.
            result = [
                row for row in result
                if bool(row.get("enabled"))
                or bool(row.get("eligible_daily"))
                or str(row.get("review_status") or "") == "approved"
                or str(row.get("curation_status") or "") == "approved"
            ]
        return result

    def list_source_integrity_activation_blockers(self) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "stat_categories?or=(enabled.eq.true,eligible_daily.eq.true)&validation_status=neq.verified&"
            "select=id,title,source_organization,validation_status,validation_reason&order=source_organization.asc,title.asc&limit=500",
        )
        return [dict(row) for row in rows] if isinstance(rows, list) else []

    def activate_source_integrity_enforcement(self) -> Any:
        return self._request("POST", "rpc/activate_source_integrity_enforcement", {})


    def record_player_source_validation(self, category_id: str, status: str, reason: str, link_quality_score: int | None = None) -> Any:
        return self._request(
            "POST",
            "rpc/record_player_source_validation",
            {
                "p_category_id": category_id,
                "p_status": status,
                "p_reason": reason,
                "p_link_quality_score": link_quality_score,
            },
        )

    def reconcile_category_playability_v144(self) -> Any:
        """Refresh legacy booleans from the authoritative v14.4 computed policy."""
        return self._request("POST", "rpc/reconcile_category_playability_v144", {})

    def get_import_health(self) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "v14_import_health?select=*&order=source_organization.asc",
        )
        return [dict(row) for row in rows] if isinstance(rows, list) else []

    def list_recent_import_runs(self, *, limit: int = 30) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "stat_import_runs?select=id,source_organization,source_dataset,status,started_at,completed_at,categories_processed,observations_inserted,error_message,details"
            f"&order=started_at.desc&limit={max(1, min(limit, 100))}",
        )
        return [dict(row) for row in rows] if isinstance(rows, list) else []

    def mark_source_success(self, slug: str) -> None:
        self._request(
            "PATCH",
            f"data_sources?id=eq.{quote(slug)}",
            {"status": "active"},
            prefer="return=minimal",
        )
