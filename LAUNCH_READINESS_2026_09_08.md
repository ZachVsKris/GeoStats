# GeoStats launch readiness, September 8, 2026

## Current assessment

| Requirement | Evidence and status |
| --- | --- |
| Start without signing up | Scout and Adventurer allow guest play. Expert keeps the previously requested account gate. Live Scout entry verified. |
| Shared Daily | Published date/mode boards, shared across players. Today's saved boards preserved. |
| Clear final score | Results show total, maximum, placement summary, and saved status. |
| Spoiler-free sharing | Native share or clipboard text includes mode, score, medals, and challenge URL without answers. |
| Challenge a friend | Result sharing includes “Can you beat my score?” and the board URL; a pre-completion Challenge a friend action is now available for shared Daily boards. |
| Mobile | Responsive layouts and mobile tests exist. Not certified launch-ready from this review alone. |
| Report a data error | Report a problem is available in desktop/mobile game controls and results, with category context and an admin-only inbox. |
| Funnel analytics | Page/start/completion/share/account events and aggregate reporting exist. A rotating first-party browser ID now supports second-game conversion and completed next-day cohorts. Admin reporting excludes internal activity; counts represent browsers rather than unique people. |

## Account reliability changes

- Use INITIAL_SESSION for immediate identity display; avoid the duplicate client getUser/profile load.
- Ignore repeated same-user auth events, including focus refreshes.
- Invalidate older profile loads when saving a username or signing out.
- Synchronize the saved username across multiple account controls on the page.
- Prefer the chosen GeoStats username over the Google display name.
- Finish the username operation without waiting for separate score verification.
- Bound profile fetch/save to 12 seconds with a retry message; avoid an indefinite busy state.
- Profile API verifies JWT claims, preserving database RLS and the authenticated-user ID filter.
- Report success only when a profile row was actually updated.

Verification: account race/event regression test, profile API authorization/write test, email POST/origin/token tests, current release static checks, TypeScript, production build.

These fixes address verified code defects. They do not prove the cause of the friend's exact minute-long delay: the available runtime-log queries timed out, and no real Google credentials were used for testing.

## Email first-link failure: awaiting independent retest

Both repository email templates use the scanner-safe /auth/email landing page and require an explicit POST before verification. The connected Supabase tools cannot read or update hosted Auth email template settings. Repository HTML is not evidence that the hosted template was changed.

Verify BOTH hosted templates: Confirm sign up for a new address, and Magic link or OTP for a returning address. A first failing signup message followed by a working returning-user message is consistent with mismatched templates, but is not proof. Other possibilities include a consumed/replaced link or a legacy PKCE browser mismatch.

The intended link in both templates is:

```html
<a href="{{ .SiteURL }}/auth/email#token_hash={{ .TokenHash }}&amp;type=email&amp;redirect_to={{ .RedirectTo }}">Sign in to GeoStats</a>
```

No changes to email expiry, DNS, SMTP, provider settings, existing Daily boards, scores, or catalog membership in this account patch. Spam placement remains a separate deliverability issue.

## September 8 launch follow-up

- Saved usernames synchronize across tabs using BroadcastChannel.
- Reports enforce same-origin requests, private database access and five submissions per network per hour. Query strings and raw IP addresses are not stored.
- Privacy page describes browser analytics and reports.
- Additive migration launch_feedback_and_funnel applied; authorization, rate limiting and funnel fixtures verified in a rolled-back transaction.
- Full local tests, production build and TypeScript passed. Release browser checks are tracked by the pull request.
- User reports updating the hosted Confirm sign up template; fresh first-time recipient test is deferred until a friend is available. Spam placement remains with the email provider investigation.
- Database approximately 707 MiB, including 519 MiB of observations. Legacy backups total approximately 94 MiB, so deleting them alone would not meet the 500 MiB allowance. No source observations, backup tables or indexes were deleted and no paid plan was purchased.
- New categories remain on hold.
