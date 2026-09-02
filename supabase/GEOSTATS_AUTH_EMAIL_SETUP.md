# GeoStats authentication production setup

This document covers the parts of authentication that must work together:
the app's PKCE callback, Supabase Auth, Google OAuth, transactional email, and
DNS-based sender authentication.

## Production identity

- Site URL: `https://geostats.xyz`
- Sender name: `GeoStats`
- Sender address: `accounts@geostats.xyz`
- Production callback handled by GeoStats: `https://geostats.xyz/auth/callback`
- Supabase project: `hmhvodulfyudogsjphsp`

The app uses passwordless email authentication. A new email address is
automatically signed up when its owner requests a link; an existing address
uses the same flow to sign in. Google OAuth is available through the same
callback route.

## Supabase URL configuration

In Authentication -> URL Configuration:

- Set Site URL to `https://geostats.xyz`
- Add the exact production redirect URL
  `https://geostats.xyz/auth/callback`
- For local testing, add `http://localhost:3000/**`
- For Vercel preview testing, add
  `https://*-zachington.vercel.app/**`

The exact production path is preferable for the live site. The preview wildcard
is only for testing and should not replace the production entry.

## Transactional email and deliverability

Supabase's default SMTP service is restricted and is not suitable for a public
signup flow. Configure a custom SMTP provider in Authentication -> Emails ->
SMTP Settings.

Use a provider that supports authenticated SMTP and a dedicated transactional
sender. Enter the provider's host, port, username, and password. Keep the
sender consistent:

- From name: `GeoStats`
- From address: `accounts@geostats.xyz`
- Confirm-signup subject: `Confirm your GeoStats account`
- Magic-link subject: `Your secure GeoStats sign-in link`
- Recovery subject: `Recover your GeoStats account`

Before sending to users:

1. Verify `geostats.xyz` with the email provider
2. Publish the provider's SPF and DKIM DNS records exactly as issued
3. Add a DMARC record, initially with `p=none` while testing
4. Turn off click tracking and link rewriting for authentication messages
5. Send test messages to Gmail, Outlook, and Apple/iCloud addresses
6. Inspect the received headers and confirm SPF, DKIM, and DMARC alignment
7. After monitoring, consider tightening DMARC to `p=quarantine` or `p=reject`

Keep authentication email separate from marketing email if marketing is added
later. Keep the templates short, branded, and focused on one action. The
templates in `supabase/email-templates/` use PKCE-compatible token hashes and
the GeoStats callback; paste them into the corresponding Supabase Auth
templates. Do not replace the token-hash parameters with a copied session URL.

## Google sign-up and sign-in

Google sign-up and sign-in use the same OAuth flow. Google automatically
confirms the email identity returned by the provider; no confirmation email is
needed for a Google-created account.

### Google Cloud

Create a Web application OAuth client in the Google Cloud Console.

- Authorized JavaScript origin: `https://geostats.xyz`
- For local testing: `http://localhost:3000`
- Authorized redirect URI:
  `https://hmhvodulfyudogsjphsp.supabase.co/auth/v1/callback`

The Supabase callback above is the URI Google must know. Do not enter
`https://geostats.xyz/auth/callback` as Google's provider callback; that is
the post-authentication callback used by the GeoStats app.

### Supabase

In Authentication -> Providers -> Google:

1. Enable Google
2. Paste the Google OAuth client ID
3. Paste the Google OAuth client secret
4. Save the provider

Use the GeoStats callback and redirect allow-list entries above. Then test both
an existing Google account and a Google account that has never used GeoStats.

## Verification checklist

- Request an email link in a private browser window
- Confirm the message arrives from `GeoStats <accounts@geostats.xyz>`
- Click it once and confirm it returns to the original game page
- Confirm a new email can choose a public username
- Confirm a returning email preserves the existing account
- Start Google sign-in and confirm the account returns to GeoStats
- Test Google in a fresh browser profile to exercise first-time sign-up
- Confirm a completed Daily score is saved after either auth path
- Confirm no auth email links are rewritten by provider click tracking

The repository code cannot create Google client credentials or publish DNS
records. Those are provider-account steps; once they are complete, the app
side is ready.
