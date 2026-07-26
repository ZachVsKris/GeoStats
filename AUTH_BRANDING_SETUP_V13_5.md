# GeoStats authentication branding setup

The v13.5 application owns the account interface, username selection, callback pages, and leaderboard identity. Supabase remains the secure session provider behind the scenes.

## Required one-time dashboard setup

1. Apply `RUN_THIS_IN_SUPABASE_FOR_V13_5.sql`.
2. In Supabase **Authentication → URL Configuration**:
   - Site URL: `https://geostats.xyz`
   - Add redirect URL: `https://geostats.xyz/auth/callback`
   - Keep the Vercel preview callback only when preview authentication is needed.
3. In **Authentication → SMTP Settings**, enable custom SMTP using a transactional provider that supports SMTP.
   - Sender name: `GeoStats`
   - Sender address: an authenticated address such as `accounts@geostats.xyz`
   - Configure SPF and DKIM at the domain provider before production use.
4. In **Authentication → Email Templates**, copy the matching files from `supabase/email-templates/`:
   - Magic Link → `magic-link.html`
   - Confirm signup → `confirmation.html`
   - Reset password → `recovery.html`
5. Use subjects such as:
   - `Your GeoStats sign-in link`
   - `Confirm your GeoStats account`
   - `Recover your GeoStats account`
6. Disable click tracking in the email provider. Rewritten authentication links can break verification.
7. Send a real test to a non-team email address and confirm that:
   - the From name is GeoStats
   - the sender uses the GeoStats domain
   - the button URL itself begins with `https://geostats.xyz/auth/callback` and returns to GeoStats
   - a first-time user is prompted inside GeoStats to choose a username

The supplied templates use `TokenHash` links through the GeoStats callback, so the clickable authentication URL is on `geostats.xyz` rather than the Supabase project domain. Supabase's built-in mail service is intended for limited testing. Production delivery and a GeoStats sender require custom SMTP.

Official references:
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/redirect-urls
