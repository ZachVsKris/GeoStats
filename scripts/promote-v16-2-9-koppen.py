#!/usr/bin/env python3
from __future__ import annotations

import json
import os

from data_pipeline.supabase import SupabaseWarehouse


def main() -> int:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and a Supabase secret/service-role key.")
    result = SupabaseWarehouse(url, key).promote_v16_2_9_koppen_bundle()
    print(json.dumps({"promoted": result}, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
