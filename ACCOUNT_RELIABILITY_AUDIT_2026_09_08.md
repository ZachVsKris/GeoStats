# GeoStats account and release audit — 8 September 2026

## Account repair

PR #17 adds one account control shared across desktop/mobile layouts. Mobile
players see a checkmark and account name outside the menu; the private account
panel displays the signed-in email. A profile-fetch failure no longer hides an
existing authenticated session. Sign-out failures remain visible instead of
pretending logout succeeded.

The new email flow requires explicit confirmation via same-origin POST.
Credentials travel in the initial URL fragment, are removed from the address bar,
and are excluded from analytics. Opening the landing page does not consume a
one-time token. Google keeps the OAuth callback. Error text no longer diagnoses
all invalid/used tokens as immediately expired. Route tests cover bad origins,
malformed tokens, unsupported types, safe destinations and service failures.
Browser tests cover direct/reopened links, missing links and explicit submission.

**Activation remains outstanding:** hosted Supabase email templates must be
replaced after deployment. Repository edits do not change the dashboard. See
`supabase/GEOSTATS_AUTH_EMAIL_SETUP.md`. Inbox placement and an actual recipient
acceptance test remain open; mocked tests do not establish either.

## Live read-only checks

- 414 enabled categories; zero unsafe-enabled and zero safe-hidden.
- All 96 restored-category proof records still match their current dependencies.
- No duplicate (account, date, mode) scores; no scores missing their Daily board.
- 19 score submissions in the preceding seven days at audit time.
- No email-like strings in public username/display-name fields.
- No credential-like authentication parameters in recorded analytics paths.
- Profiles, Daily scores and analytics tables all have RLS enabled.
- Existing public recovery-readiness SQL function is read-only, fixed-search-path,
  returns a boolean and is intentionally callable by catalog readers. Advisor
  warnings for it were reviewed; no speculative permission changes were made.
- Password leak protection is not enabled; current product uses Google/email-link
  authentication. Do not present the advisor as a detected compromised account.

## Quota

Removed an exact duplicate observation index, freeing approximately 70 MiB.
Database size dropped from 816123027 to 742714515 bytes. This remains an overage;
no historical data, source observations or scores were deleted. See
`supabase/maintenance/2026-09-08-duplicate-index.md` for details and rollback.
An organization plan/retention decision remains separate from this reversible
index cleanup.

## Remaining catalog work

The existing 242-candidate disposition ledger still contains 96 promotions and
146 unresolved entries: 92 source-verification, 30 coverage, 11 stale-data,
7 subjective/composite, 2 source-link, 2 duplicate, 1 explicit product exclusion,
and 1 noncomparable-units case. No evidence justifies bulk promotion.

A fresh IPU check found accessible official country history and dictionary pages:
https://data.ipu.org/parliament/US/US-LC01/elections/historical-data-on-women
https://data.ipu.org/data-dictionary/suffrage/
The US page lists multiple national-universal dates (1920 and 1965). A working
page alone does not resolve earliest-universal semantics or the omitted-country
universe. The old archive link still failed to open. Independence still has the
previously documented post-1940 definition/universe mismatch. Both remain held;
this is source/editorial work, not an owner login task or a permanent rejection.

Preserve the 7 September audit's scored-history rules, one-demographic maximum,
two-physical-geography minimum, family exclusions and source-bound witness
requirements. The precipitation/icon fix and Daily copy cache refresh are
already in baseline main (2e81c3a). This pass does not regenerate scored Dailies.

## Verification record

Released through [PR #17](https://github.com/ZachVsKris/GeoStats/pull/17), squash
commit `d8b9c1a7d6c82dcd3364b12d7daaa33deade9484`. Production deployment
`dpl_6D5AAhVR2hNSXkqyuwcFG6hs79Gd` reached READY with `geostats.xyz` assigned.
The live Daily header has one account control, and the live email landing page
shows the explicit confirmation button for a synthetic test link without
consuming a real credential. Hosted template activation is still outstanding.

[CI run 34196755794](https://github.com/ZachVsKris/GeoStats/actions/runs/34196755794)
passed the complete code/importer/source-policy suite, TypeScript, pinned Natural
Earth data, production build and six browser/device profiles. Browser result:
181 passed, one Safari desktop email-landing test passed on retry, four intentional
phone-only skips on desktop profiles. The first Safari attempt timed out waiting
for the confirmation button; do not describe this run as having no retries.

Local route and catalog behavior tests passed. The initial local full importer
run stopped at missing Shapely and the initial browser run lacked binaries.
After installing Chromium, both email checks passed on desktop; both email checks
and the small-screen rules/menu check passed on Android emulation (five focused
checks total). The final production build also passed locally.

Actual Gmail/Yahoo recipient confirmation, first-time inbox placement and the
signed-in identity on the user's physical phone remain acceptance steps after
hosted template activation. Neither synthetic credentials nor mocked tests prove
those outcomes.
