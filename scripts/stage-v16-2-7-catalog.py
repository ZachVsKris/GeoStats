#!/usr/bin/env python3
from __future__ import annotations
import os
from data_pipeline.supabase import SupabaseWarehouse

def main() -> int:
    url=(os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL') or '').strip()
    key=(os.environ.get('SUPABASE_SECRET_KEY') or os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or '').strip()
    if not url or not key:
        raise SystemExit('SUPABASE_URL and a Supabase service-role secret are required.')
    result=SupabaseWarehouse(url,key).stage_v16_2_7_candidate_catalog()
    print(f'GeoStats v16.2.7 candidate catalog staged for production reachability proof: {result}')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
