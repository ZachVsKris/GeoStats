export function friendlyAuthError(value: unknown) {
  const raw = value instanceof Error ? value.message : String(value ?? "");
  if (/code challenge.*code verifier|pkce/i.test(raw)) return "This sign-in link was opened in a different browser session. Return to GeoStats and request a new link.";
  if (/expired|otp_expired/i.test(raw)) return "This sign-in link is invalid, already used, or expired. Return to GeoStats and request a new one.";
  if (/already.*used|invalid.*token|token.*invalid/i.test(raw)) return "This sign-in link is invalid or has already been used. Return to GeoStats and request a new one.";
  if (/provider.*not enabled|unsupported provider/i.test(raw)) return "That sign-in option is not available yet. Use the email sign-in link instead.";
  if (/rate limit|too many requests/i.test(raw)) return "Too many sign-in attempts were made. Wait a minute, then request a new link.";
  return "GeoStats could not complete sign-in. Return to the game and try again.";
}

