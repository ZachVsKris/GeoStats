#!/usr/bin/env python3
from __future__ import annotations
import argparse
import os
from data_pipeline.supabase import SupabaseWarehouse

def main() -> int:
    parser=argparse.ArgumentParser(description="Publish the guarded GeoStats v16.2.x shared gameplay catalog.")
    parser.add_argument("--release-version",choices=("16.2.1","16.2.2"),default="16.2.2")
    args=parser.parse_args()
    url=os.environ.get("SUPABASE_URL")
    key=os.environ.get("SUPABASE_SECRET_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and a Supabase service-role secret.")
    SupabaseWarehouse(url,key).finalize_v16_catalog(release_version=args.release_version)
    print(f"GeoStats v{args.release_version} catalog finalized after guarded source recovery.")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
