#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time

from data_pipeline.supabase import SupabaseWarehouse


EXPECTED_CATEGORY_COUNT = 11


def publication_is_complete(warehouse: SupabaseWarehouse) -> bool:
    rows = warehouse.list_v16_2_9_koppen_publication_state()
    return (
        len(rows) == EXPECTED_CATEGORY_COUNT
        and all(row.get("computed_playable_v16_2") is True for row in rows)
    )


def main() -> int:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and a Supabase secret/service-role key.")
    warehouse = SupabaseWarehouse(url, key)
    try:
        result = warehouse.promote_v16_2_9_koppen_bundle()
    except RuntimeError as error:
        # PostgREST's upstream gateway can return 504 while PostgreSQL continues
        # and commits this intentionally long, atomic promotion. Recover only
        # when the exact database postcondition proves all 11 rows published.
        if "(504)" not in str(error) and "upstream request timeout" not in str(error):
            raise
        for _ in range(24):
            if publication_is_complete(warehouse):
                result = EXPECTED_CATEGORY_COUNT
                break
            time.sleep(5)
        else:
            raise
    print(json.dumps({"promoted": result}, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
