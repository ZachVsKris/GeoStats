# GeoStats v16.2.3 installation

v16.2.3 is a reliability, performance, catalog-status, and broad-history release built on v16.2.2.

## Before production deployment

1. Take a Supabase database snapshot.
2. Run `RUN_THIS_IN_SUPABASE_FOR_V16_2_3.sql` in Supabase. This is cumulative from v16.2.1: it contains the corrected v16.2.2 migration followed by v16.2.3.
3. Reload the Supabase/PostgREST schema cache if your project does not pick up new functions/views immediately.
4. Push the v16.2.3 repository and require GitHub **Verify GeoStats v16.2.3** to be green.
5. Import/finalize the historical catalog and run the database verification below.
6. Deploy or redeploy/promote v16.2.3 to production **after** finalization so the first production Daily/Random cache snapshots see the finalized catalog. If Vercel auto-deploys on the repository push, trigger one final redeploy after finalization and verification.

## Load and verify historical data

Run **Import v16.2.3 historical categories and finalize**. It imports and independently re-audits:

- United Nations membership dates
- Constitute current-constitution enactment years
- Inter-Parliamentary Union post-1940 independence dates and national universal women's suffrage milestones

The workflow then runs the guarded v16.2.3 finalizer. The universal-suffrage category is allowed to remain non-playable when incomplete country coverage cannot safely support a lowest-wins ranking; source verification never overrides that safety rule.

For a full recovery, use **Recover v16.2.3 audited catalog** instead.

## Database verification

Run `VERIFY_V16_2_3.sql`. Every final check should return `PASS` before relying on the catalog or scheduled Daily publication.

The verification explicitly checks:

- source-audit thresholds
- four historical source-verified categories
- the shared Daily/Random playable gate
- zero pending editorial rows
- the 307-row backlog disposition split
- no unverified playable category
- Daily publication RPC and `service_role` permission
- pgcrypto/digest schema visibility
- measurement metadata

## Rollback

The preferred rollback is the pre-install database snapshot. `ROLLBACK_V16_2_3.sql` is also supplied as a conservative data rollback: it restores the previous editorial states, disables v16.2.3-only historical categories, restores the v16.2.2 constitution direction when verified, and recomputes the shared catalog.
