from __future__ import annotations

import json
import time
from typing import Any, Iterable
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


class SupabaseWarehouse:
    def __init__(self, url: str, key: str, *, timeout: int = 180) -> None:
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


    def list_categories_by_source(self, source_organization: str) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "stat_categories?"
            f"source_organization=eq.{quote(source_organization, safe='')}&"
            "select=*&order=title.asc&limit=10000",
        )
        return [dict(row) for row in rows] if isinstance(rows, list) else []

    def patch_category(self, category_id: str, fields: dict[str, Any]) -> None:
        self._request(
            "PATCH",
            f"stat_categories?id=eq.{quote(category_id, safe='')}",
            fields,
            prefer="return=minimal",
        )

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

    def replace_category_observations(self, category_id: str, rows: Iterable[dict[str, Any]]) -> int:
        """Atomically replace one category's observations through the v16.2 RPC."""
        payload = list(rows)
        result = self._request(
            "POST",
            "rpc/replace_stat_category_observations_v16_2",
            {"p_category_id": category_id, "p_rows": payload},
        )
        if isinstance(result, int):
            return result
        if isinstance(result, list) and result:
            return int(result[0])
        return len(payload)

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
        payload = result.rpc_payload(category_id, run_id=run_id)
        for attempt in range(3):
            try:
                self._request("POST", "rpc/record_category_validation", payload)
                return
            except RuntimeError as error:
                # 57014 is PostgreSQL query_canceled, normally a statement timeout.
                # Validation writes are idempotent for catalog state; a later result row
                # is acceptable and the category remains fail-closed until one succeeds.
                if "57014" not in str(error) or attempt == 2:
                    raise
                time.sleep(2 ** attempt)

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

    def reconcile_category_playability_v15(self) -> Any:
        """Refresh runtime booleans from the authoritative v15 review policy."""
        for attempt in range(3):
            try:
                return self._request("POST", "rpc/reconcile_category_playability_v15", {})
            except RuntimeError as error:
                if "57014" not in str(error) or attempt == 2:
                    raise
                time.sleep(2 ** attempt)
        return None

    def finalize_v16_catalog(self, *, release_version: str = "16.2.6") -> Any:
        """Publish only through the guarded v16.2.x finalizer for the requested release."""
        if release_version not in {"16.2.1", "16.2.2", "16.2.3", "16.2.4", "16.2.5", "16.2.6"}:
            raise ValueError(f"Unsupported guarded catalog release: {release_version}")
        guard = ({"16.2.1": "assert_v16_2_1_source_recovery", "16.2.2": "assert_v16_2_2_source_recovery", "16.2.3": "assert_v16_2_3_source_recovery", "16.2.4": "assert_v16_2_4_release", "16.2.5": "assert_v16_2_5_release", "16.2.6": "assert_v16_2_6_release"})[release_version]
        self._request("POST", f"rpc/{guard}", {})
        return self._request("POST", "rpc/finalize_v16_2_catalog", {})

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


    def list_catalog_review_v15_5(self) -> list[dict[str, Any]]:
        rows = self._request(
            "GET",
            "category_catalog_review_v15_5?select=*&order=knowledge_cluster.asc,title.asc&limit=5000",
        )
        return [dict(row) for row in rows] if isinstance(rows, list) else []

    def list_category_observations_paged(
        self,
        category_ids: list[str],
        *,
        year_by_category: dict[str, int],
        page_size: int = 1000,
        category_chunk_size: int = 12,
    ) -> list[dict[str, Any]]:
        """Fetch each category's common-year observations without a warehouse-wide scan.

        The old implementation placed every viable category in one enormous
        ``category_id=in.(...)`` filter, fetched every historical year, and used
        deep ``offset`` pagination before discarding non-common-year rows in
        Python. On a mature catalog that produced very long URLs and statements
        that timed out around offset 73,000.

        Categories are now grouped by their common year, split into small ID
        chunks, and filtered by ``data_year`` in PostgREST. A timed-out chunk is
        recursively divided, so the operation fails closed only when a single
        category query cannot complete.
        """
        if not category_ids:
            return []
        if page_size < 1:
            raise ValueError("page_size must be positive")
        if category_chunk_size < 1:
            raise ValueError("category_chunk_size must be positive")

        ids_by_year: dict[int, list[str]] = {}
        for category_id in dict.fromkeys(str(value) for value in category_ids):
            expected_year = year_by_category.get(category_id)
            if expected_year is None:
                continue
            ids_by_year.setdefault(int(expected_year), []).append(category_id)

        rows: list[dict[str, Any]] = []

        def fetch_chunk(category_chunk: list[str], data_year: int) -> None:
            encoded_ids = ",".join(
                quote(value, safe=":-_.") for value in category_chunk
            )
            offset = 0
            try:
                while True:
                    batch = self._request(
                        "GET",
                        "stat_observations?"
                        f"category_id=in.({encoded_ids})&"
                        f"data_year=eq.{data_year}&"
                        "select=category_id,country_iso3,data_year,value&"
                        f"order=category_id.asc,country_iso3.asc&limit={page_size}&offset={offset}",
                    )
                    if not isinstance(batch, list) or not batch:
                        break
                    rows.extend(dict(row) for row in batch)
                    if len(batch) < page_size:
                        break
                    offset += page_size
            except RuntimeError as error:
                detail = str(error).lower()
                is_statement_timeout = (
                    "statement timeout" in detail
                    or '"code":"57014"' in detail
                    or "failed (500)" in detail
                )
                if not is_statement_timeout or len(category_chunk) == 1:
                    raise
                midpoint = len(category_chunk) // 2
                fetch_chunk(category_chunk[:midpoint], data_year)
                fetch_chunk(category_chunk[midpoint:], data_year)

        for data_year, year_ids in sorted(ids_by_year.items()):
            for start in range(0, len(year_ids), category_chunk_size):
                fetch_chunk(year_ids[start:start + category_chunk_size], data_year)

        return rows

    def upsert_similarity_pairs_v15_5(self, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        self._request(
            "POST",
            "category_similarity_pairs_v15_5?on_conflict=category_id_a,category_id_b",
            rows,
            prefer="resolution=merge-duplicates,return=minimal",
        )

    def patch_catalog_editorial_v15_5(self, category_id: str, fields: dict[str, Any]) -> None:
        self._request(
            "PATCH",
            f"category_catalog_editorial_v15_5?category_id=eq.{quote(category_id, safe='')}",
            fields,
            prefer="return=minimal",
        )

    def mark_source_success(self, slug: str) -> None:
        self._request(
            "PATCH",
            f"data_sources?id=eq.{quote(slug)}",
            {"status": "active"},
            prefer="return=minimal",
        )
