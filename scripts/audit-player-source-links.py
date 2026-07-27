#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import ssl
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlparse
from urllib.request import Request, urlopen

from data_pipeline.player_source_links import human_readable_external_url
from data_pipeline.supabase import SupabaseWarehouse

AUDIT_VERSION = "geostats-v14.3.1-player-link-v1"


def fetch_html(url: str, timeout: int = 35) -> tuple[str, str, str | None, str]:
    request = Request(url, headers={
        "User-Agent": "GeoStats/14.3.1 player-source-link-audit",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
    })
    context = ssl.create_default_context()
    with urlopen(request, timeout=timeout, context=context) as response:
        content_type = str(response.headers.get("Content-Type") or "").lower()
        disposition = response.headers.get("Content-Disposition")
        body = response.read(1_500_000).decode("utf-8", errors="replace")
        return response.geturl(), content_type, disposition, body


def exactness(row: dict, final_url: str, body: str) -> tuple[bool, str]:
    source = str(row.get("source_organization") or "")
    code = str(row.get("source_indicator_code") or "")
    parsed = urlparse(final_url)
    decoded = unquote(f"{parsed.path}?{parsed.query}#{parsed.fragment}").lower()
    if source == "World Bank":
        ok = parsed.hostname == "data.worldbank.org" and f"/indicator/{code.lower()}" in decoded
        return ok, "World Bank indicator code is present in the official indicator-page URL." if ok else "World Bank URL does not identify the exact indicator."
    if source == "UNESCO UIS":
        ok = parsed.hostname == "databrowser.uis.unesco.org" and parsed.path.startswith("/browser/") and code.lower() in decoded and code.lower() in body.lower()
        return ok, "UIS Data Browser page and URL both identify the exact indicator." if ok else "UIS page does not prove that the exact indicator is selected in a shareable browser view."
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    marker = str(metadata.get("player_source_exact_marker") or "")
    if marker and marker == code and (code.lower() in decoded or code.lower() in body.lower()):
        return True, "Manually supplied official deep link passed its stored exact-indicator marker."
    return False, "This provider has no source-specific proof that the page shows the exact filtered data."


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate human-readable exact player source links.")
    parser.add_argument("--report-dir", default="artifacts/player-source-links")
    args = parser.parse_args()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")
    warehouse = SupabaseWarehouse(url, key)
    rows = warehouse._request(
        "GET",
        "stat_categories?content_review_status=eq.approved&player_source_url=not.is.null&"
        "select=id,title,source_organization,source_indicator_code,player_source_url,player_source_status,metadata&"
        "order=source_organization.asc,title.asc&limit=5000",
    ) or []
    results = []
    for index, row in enumerate(rows, 1):
        category_id = str(row.get("id"))
        target = str(row.get("player_source_url") or "")
        status = "invalid"
        score = 0
        reason = ""
        print(f"[{index}/{len(rows)}] {row.get('source_organization')} · {row.get('title')}", flush=True)
        if not human_readable_external_url(target):
            reason = "Rejected because the URL is not a safe human-readable HTTPS page."
        else:
            try:
                final_url, content_type, disposition, body = fetch_html(target)
                if not content_type.startswith("text/html") and "application/xhtml+xml" not in content_type:
                    reason = f"Rejected because the server returned {content_type or 'an unknown content type'}, not HTML."
                elif disposition and "attachment" in disposition.lower():
                    reason = "Rejected because the source forces a file download."
                else:
                    exact, exact_reason = exactness(row, final_url, body)
                    if exact:
                        status = "exact"
                        score = 100
                        reason = f"Live HTML check passed. {exact_reason}"
                    else:
                        status = "needs_exact_url"
                        reason = exact_reason
            except (HTTPError, URLError, TimeoutError, OSError) as error:
                status = "pending"
                score = 0
                reason = f"Live link check could not complete: {error}"
        warehouse.record_player_source_validation(category_id, status, reason, score)
        results.append({**row, "audit_status": status, "audit_reason": reason, "link_quality_score": score})
        print(f"  {status}: {reason}", flush=True)

    report_dir = Path(args.report_dir)
    report_dir.mkdir(parents=True, exist_ok=True)
    payload = {"version": AUDIT_VERSION, "generated_at": datetime.now(timezone.utc).isoformat(), "results": results}
    (report_dir / "player-source-link-report.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    lines = ["# Player Source Link Audit", "", f"Audit version: `{AUDIT_VERSION}`", "", "| Source | Category | Result | Reason |", "|---|---|---|---|"]
    for row in results:
        lines.append(f"| {row.get('source_organization')} | {row.get('title')} | {row['audit_status']} | {str(row['audit_reason']).replace('|','/')} |")
    (report_dir / "player-source-link-report.md").write_text("\n".join(lines) + "\n")
    failed = sum(1 for row in results if row["audit_status"] != "exact")
    print({"selected": len(results), "exact": len(results) - failed, "not_exact": failed}, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
