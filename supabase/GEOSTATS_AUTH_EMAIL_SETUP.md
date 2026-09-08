# GeoStats email sign-in activation

Deploy the account reliability change before updating hosted templates.
Repository templates do not automatically update hosted Supabase Auth settings.

## Existing sender settings

- Sender: `GeoStats <accounts@geostats.xyz>`
- Site URL: `https://geostats.xyz`
- OAuth/legacy redirect URL: `https://geostats.xyz/auth/callback`
- Keep Resend open and click tracking off for authentication emails.

The supplied Yahoo message passed SPF, DKIM and DMARC. Resend domain verification
and SMTP acceptance are confirmed, but neither proves inbox placement. The
first-time Gmail/Yahoo spam issue remains with the deliverability investigation.
Do not replace working DNS authentication records as a speculative fix.

## Hosted templates to replace after deployment

Supabase → Authentication → Emails → Templates:

1. **Confirm sign up**: copy `email-templates/confirmation.html`.
   Subject: `Confirm your email for GeoStats`.
2. **Magic link or OTP**: copy `email-templates/magic-link.html`.
   Subject: `Your GeoStats sign-in link`.
3. **Reset password**, if used: copy `email-templates/recovery.html`.
   Subject: `Recover your GeoStats account`.

The new link is `/auth/email#token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`
(the recovery template uses `type=recovery`). Preserve the template's HTML escaping.
The fragment keeps the credential out of server request URLs. Opening the page
never verifies the token. The user must press **Confirm and sign in**, which sends
a same-origin POST and sets the session cookies. This also avoids requiring the
browser session that originally requested a PKCE email link. Google sign-in still
uses the existing OAuth callback.

The connected database tools cannot update hosted Auth templates. If dashboard
access is unavailable, this is the remaining owner activation step; do not claim
email authentication fixed in production until it is done.

## Acceptance

Request a fresh email after template activation. Open it on Yahoo/Gmail, press
**Confirm and sign in**, and verify the account indicator and email in the private
account panel. Repeat in a different browser from the requesting browser. Reusing
the same token should show the invalid/used/expired recovery message. A GET or a
mail scanner opening the landing page should not consume the token. Keep Google
sign-in, refresh persistence, sign-out and saved Daily scores in the smoke test.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
