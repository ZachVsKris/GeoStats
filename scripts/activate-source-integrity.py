#!/usr/bin/env python3
from __future__ import annotations
import os
from data_pipeline.supabase import SupabaseWarehouse

url = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
key = (os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
if not url or not key:
    raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required.")
print(SupabaseWarehouse(url, key).activate_source_integrity_enforcement())
