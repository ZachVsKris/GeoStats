# GeoStats v16.3.0 owner finish checklist

Code, database migrations, catalog copy, scoring, public leaderboard, email-template files, and deployment verification are handled by the release. These are the actions that require the account owner or a secret that must never be shared in chat.

## 1. Enable Google sign-in

1. In Google Cloud Console, create or select the GeoStats project.
2. Open Google Auth Platform and configure an **External** app.
3. App name: `GeoStats`; support email: your owner-controlled address.
4. Add homepage `https://geostats.xyz`, privacy `https://geostats.xyz/privacy`, and terms `https://geostats.xyz/terms`.
5. Request only `openid`, `email`, and `profile`.
6. Create an OAuth client of type **Web application**.
7. Authorized JavaScript origin: `https://geostats.xyz`.
8. Authorized redirect URI: `https://hmhvodulfyudogsjphsp.supabase.co/auth/v1/callback`.
9. Copy the client ID and client secret directly into Supabase Dashboard → Authentication → Sign In / Providers → Google. Never paste the secret into chat, GitHub, Vercel, or a local file.
10. Enable Google and save. GeoStats checks `/auth/v1/settings` before redirecting, so the current unavailable state will automatically become the working Google button without another code change.
11. Test a new account, returning account, same-email email/Google sign-in, sign-out, username selection, Expert access, and automatic score saving.

## 2. Enable leaked-password protection

In Supabase Dashboard → Authentication → Attack Protection / Password Security, enable leaked-password protection. GeoStats is passwordless today, but this removes the only remaining Supabase security warning and protects any future password flow.

## 3. Confirm authentication email settings

1. Supabase Authentication → Emails → SMTP: sender name `GeoStats`; sender email `accounts@geostats.xyz`.
2. Confirm the dashboard's Magic link, Confirm signup, and Recovery bodies match the files in `supabase/email-templates/`.
3. In Resend, keep click/open tracking disabled for authentication mail so one-time links are not rewritten.
4. Send tests to Gmail, Outlook, iCloud, and one unrelated address. Confirm the visible sender, inbox/spam placement, and the complete sign-in journey.
5. In Resend Logs, confirm delivered status and passing SPF/DKIM/DMARC authentication. Do not share message contents, API keys, or recipient addresses.
6. Leave DMARC at monitoring (`p=none`) until all legitimate GeoStats senders have been observed. Later move gradually to quarantine/reject only if the reports are clean.

## 4. Final owner acceptance

- Public visitors can open `/leaderboard` without signing in.
- Scout and Adventurer work signed out; Expert asks for an account.
- A signed-in user can choose a unique public username and save one verified score per mode/day.
- `/random` redirects non-owner visitors and remains absent from public navigation.
- `/admin` and `/admin/review` work only for the owner account.
