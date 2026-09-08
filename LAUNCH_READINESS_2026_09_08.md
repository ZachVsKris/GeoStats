# GeoStats launch readiness, September 8, 2026

## Current assessment

| Requirement | Evidence and status |
| --- | --- |
| Start without signing up | Scout and Adventurer allow guest play. Expert keeps the previously requested account gate. Live Scout entry verified. |
| Shared Daily | Published date/mode boards, shared across players. Today's saved boards preserved. |
| Clear final score | Results show total, maximum, placement summary, and saved status. |
| Spoiler-free sharing | Native share or clipboard text includes mode, score, medals, and challenge URL without answers. |
| Challenge a friend | Result sharing includes “Can you beat my score?” and the board URL; no separate pre-completion friend-challenge action. |
| Mobile | Responsive layouts and mobile tests exist. Not certified launch-ready from this review alone. |
| Report a data error | Data audit/source information exists; no obvious dedicated player report control found. |
| Funnel analytics | Page/start/completion/share/account events and aggregate reporting exist. Session IDs plus a returning flag do not establish anonymous next-day cohort retention. Explicit next-day retention and second-game conversion remain gaps. |

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

## Email first-link failure: unresolved production setting

Both repository email templates use the scanner-safe /auth/email landing page and require an explicit POST before verification. The connected Supabase tools cannot read or update hosted Auth email template settings. Repository HTML is not evidence that the hosted template was changed.

Verify BOTH hosted templates: Confirm sign up for a new address, and Magic link or OTP for a returning address. A first failing signup message followed by a working returning-user message is consistent with mismatched templates, but is not proof. Other possibilities include a consumed/replaced link or a legacy PKCE browser mismatch.

The intended link in both templates is:

```html
<a href="{{ .SiteURL }}/auth/email#token_hash={{ .TokenHash }}&amp;type=email&amp;redirect_to={{ .RedirectTo }}">Sign in to GeoStats</a>
```

No changes to email expiry, DNS, SMTP, provider settings, existing Daily boards, scores, or catalog membership in this account patch. Spam placement remains a separate deliverability issue.
