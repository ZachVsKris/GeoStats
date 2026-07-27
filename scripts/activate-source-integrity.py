#!/usr/bin/env python3
from __future__ import annotations

import json
import os

from data_pipeline.supabase import SupabaseWarehouse

url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
if not url or not key:
    raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")

warehouse = SupabaseWarehouse(url, key)
blockers = warehouse.list_source_integrity_activation_blockers()
if blockers:
    print(json.dumps({
        "activation": "skipped",
        "reason": f"{len(blockers)} currently playable categories are not verified.",
        "blockers": blockers,
    }, indent=2), flush=True)
    raise SystemExit(1)

try:
    print(json.dumps({"activation": "activated", "result": warehouse.activate_source_integrity_enforcement()}, indent=2), flush=True)
except Exception as error:
    print(json.dumps({"activation": "failed", "reason": str(error)}, indent=2), flush=True)
    raise SystemExit(1)
