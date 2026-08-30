# GeoStats authentication email production setup

The HTML templates in `supabase/email-templates/` are GeoStats-branded and ready
to paste into Supabase Auth email templates. The visible sender also requires a
custom SMTP provider; it cannot be established safely from repository code.

## Production settings

- Sender name: `GeoStats`
- Sender address: `accounts@geostats.xyz`
- Site URL: `https://geostats.xyz`
- Allowed redirect URL: `https://geostats.xyz/auth/callback`
- Templates: use the confirmation, magic-link, and recovery HTML files in this
  directory without changing their `TokenHash`, `type`, or `redirect_to` values.

## Activation boundary

In Supabase Dashboard, open Authentication → Email/SMTP and enter the SMTP host,
port, username, and password issued by the chosen mail provider. Verify
`geostats.xyz` with that provider first and publish its SPF and DKIM DNS records;
add a DMARC policy after delivery tests pass. Turn off provider click tracking
for authentication mail because rewritten links can invalidate one-time tokens.

Send a test magic link to an owner-controlled address, confirm that the inbox
shows `GeoStats <accounts@geostats.xyz>`, and verify that it returns to the
original GeoStats path through `/auth/callback`.
