# GeoStats recovery checkpoint — 2026-09-07

Not a completed release. Application changes below are local and not deployed.

## Implemented

- Real-metadata lake conflicts, related land-area and freshwater concepts, and animal-output classification for cheese/butter/ghee/honey.
- Explicit other-religions wording, climate-specific icons/descriptions, and area-density rate labels.
- Right-edge, vertically centered SVG removal controls with larger hit areas and keyboard focus indication. Existing mobile results layout retained.
- Same-origin auth callback destinations, including encoded slash/backslash rejection; session refresh through getClaims.
- Google availability distinguishes disabled from unknown/network failure; retry remains possible. Async profile/score work runs outside auth callbacks; failed score saves retain local results.
- Leaderboard reads all pages, including when server row caps are below the requested page size; partial reads fail closed.
- Game starts count valid first placements, not board loads; practice/Random do not count as starts.
- Capacity results distinguish witnessed feasibility, proven gate failures, and unresolved bounded searches.
- Atomic single/batch category-review RPCs, optimistic concurrency, audit-event atomicity, and durable explicit editorial/copy contracts. Public and ordinary authenticated RPC access revoked. Technical validation and protected product exclusions remain enforced.
- Admin routes call transactional RPCs; bulk editorial approval is distinct from technical publication readiness.

## Live database changes

Applied migrations `20260907194310_v16_3_4_atomic_category_review.sql` and `20260907194515_v16_3_4_atomic_category_review_batches.sql`.

The new contracts table is empty: no live category decisions or wording have been changed by these migrations. No scored Daily board or score was altered. Current published catalog remains **318**.

Rollback-only database tests passed for protected RPC access, reviewed wording surviving the complete refresh, stale-edit rejection, successful two-category batch response, and rollback of an earlier batch write when a later item is stale. Each full refresh ended with 318 ready/enabled, zero safe-hidden, zero unsafe-published.

## Verification

- Production build passed. TypeScript also passed after the final batch-route cleanup.
- New behavior tests passed against real published metadata, malicious redirects, Google provider failures, and 2,507-row pagination with 1,000/200-row caps.
- Production generator regression suite passed.
- Current v16.2.6–v16.3.4 static checks passed after updating checks for extracted helpers and tri-state capacity assessment. Obsolete standalone v16.1 checks still expect their historical release and are not part of the current test chain.
- Offline recovery audit loaded 325 categories and 46,902 common-year observations. Seven proposed copy-repair candidates each produced valid anchored boards in all three modes (21 successes), and a new complete Daily trio passed the production validator. Evidence is retained in `audits/recovery-candidate-proofs-2026-09-07.json`. These candidates are **not promoted yet**; final database gates and presentation synchronization remain required.
- Browser visual verification is **blocked**: the controlled browser returned `net::ERR_BLOCKED_BY_CLIENT` for the local preview. No mobile/desktop visual pass is claimed. Temporary local preview files were removed and its server stopped.
- Full importer/cross-browser CI has not been rerun. No production deployment performed.

## Next steps

1. Push a review branch and verify a hosted preview, including actual phone/desktop placement/removal/results and account error paths.
2. Complete and retain fresh solver evidence for the repaired catalog; publish individually verified candidates with durable copy and current evidence, not blanket overrides of credibility or completeness gates.
3. Repair the remaining 72 approved-but-blocked and 170 manual candidates generously, preserving explicit retirements and deduplicating. The seven candidates just tested are still part of that backlog. “Most lakes” still has a legacy credibility quarantine plus a genuine cartographic-inventory scope caveat; do not silently claim Natural Earth is an exhaustive lake census.
4. Make publication evidence depend on current rules/data/semantics, replace the old incoming-row-blind flag trigger, improve machine-readable blocker reasons, and test refresh/import idempotence beyond the new explicit review contracts.
5. Review remaining database/runtime title conflicts and synchronize the presentation contract.
6. Finish QA analytics/acquisition attribution, bounded source-expansion work, and current-catalog capacity acceptance.
7. Verify Google provider configuration and email SMTP/SPF/DKIM/DMARC with the owner where credentials or DNS/provider authority are required. Neither Google sign-in nor inbox deliverability has been accepted as working.
8. Deploy only after the relevant release checks pass; preserve scored historical Daily snapshots.
