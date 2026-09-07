# GeoStats recovery checkpoint — 2026-09-07

Production code and catalog recovery are deployed. This supersedes the earlier local-only checkpoint.

## Accepted catalog result

- 318 → **410** playable/enabled categories: **92 additions**, no baseline removals.
- Scout: 410. Adventurer and Expert: 409 each. Arctic land area is Scout-only; the engine and validator enforce the restriction.
- 274 exact-data full-board witnesses passed against the actual live catalog without proposal overrides. Complete Daily trio validation passed.
- Repeat full refresh: 410 ready/enabled, zero safe-hidden, zero unsafe-published; all 92 recovery proofs remain current.
- No source observation values, historical scored Dailies or user scores were altered.
- 150 original candidates remain: 42 editorial-approved and 108 in other review states. These are source/coverage/definition/duplicate/policy follow-ups, not a blanket rejection of the concepts.

See MAXIMUM_CATALOG_RECOVERY_2026_09_07.md and audits/maximum-candidate-dispositions-2026-09-07.json for the complete promotion inventory and remaining reasons.

## Application changes deployed in this recovery

- Source-aware lake/land/freshwater and animal-output semantic conflict rules; clarified other-religions wording and climate icons.
- Right-edge vertically centered removal controls and larger hit areas; existing mobile results improvements preserved.
- Safe same-origin auth redirects, Google disabled-versus-unknown handling, retry-safe score persistence and async auth callback work.
- Complete leaderboard pagination; first-valid-placement start events; tri-state capacity results.
- Atomic single/batch category-review RPCs with optimistic concurrency, audit-event atomicity and durable presentation/review contracts.
- Source-bound recovery exceptions, actual-bank distinct-value prefilters and mode-specific eligibility.

Code commit fac7d368a9833eedecfd9734fa4b9134d24dd8de reached Vercel production READY. Earlier app changes landed in cd849963844875ea5b783fd0243a63f063b39d50. Applied catalog migrations are 20260907201754, 20260907202915 and 20260907203421. Atomic-review migrations 20260907194310 and 20260907194515 remain applied; the contracts table is no longer empty.

## Verification limits and follow-up

- Build, TypeScript, focused current static/behavior checks, source-integrity fixtures and production-generator regressions passed.
- Full importer suite stopped at missing workspace Python dependencies (Shapely; separate FAOSTAT check also lacks pycountry). It is not accepted as a full suite pass.
- Browser visual verification was blocked by the preview browser's ERR_BLOCKED_BY_CLIENT. Mobile/desktop visual acceptance still needs a successful browser pass.
- Google provider configuration, end-to-end Google login and SMTP/SPF/DKIM/DMARC/inbox delivery remain unverified. Do not describe signup or deliverability as completed.
- More categories may become viable through source reimport, exact source-link verification or justified coverage review. Do not loosen source truth, comparable units, explicit retirements or duplicate protections just to increase the count.
- Future rule/formatter/semantic changes must regenerate recovery witnesses and update their rules-version contract before claiming current evidence. Saved witnesses do not establish feasibility for every seed or guarantee immediate appearance in historical Dailies.
