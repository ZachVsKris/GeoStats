#!/usr/bin/env python3
from __future__ import annotations
import os
from data_pipeline.supabase import SupabaseWarehouse

def main() -> int:
    url=os.environ.get("SUPABASE_URL")
    key=os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and a Supabase service-role secret.")
    SupabaseWarehouse(url,key).finalize_v16_catalog()
    print("GeoStats v16.2 catalog finalized.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
