"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { safeAuthNext } from "../lib/authRedirect";

export default function EmailConfirmation() {
  const [details, setDetails] = useState<{ token: string; type: string; next: string } | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    // Fragments never reach server access logs or HTTP Referer headers.
    if (!window.location.hash) return;
    const incoming = new URL(window.location.href);
    incoming.search = incoming.hash.slice(1);
    const token = incoming.searchParams.get("token_hash") || "";
    const type = incoming.searchParams.get("type") || "email";
    if (/^[a-zA-Z0-9_-]{20,512}$/.test(token) && ["email", "recovery"].includes(type)) {
      setDetails({ token, type, next: safeAuthNext(incoming) });
    }
    window.history.replaceState(window.history.state, "", window.location.pathname);
  }, []);
  if (!details) return <>
    <p>Open the latest GeoStats email link to continue. If you refreshed this page, reopen the link from your email.</p>
    <Link href="/daily">Return to GeoStats</Link>
  </>;
  return <>
    <p>Confirm below to sign in with the account that received this email.</p>
    <form method="post" action="/auth/email/verify" onSubmit={() => setPending(true)}>
      <input type="hidden" name="token_hash" value={details.token} />
      <input type="hidden" name="type" value={details.type} />
      <input type="hidden" name="next" value={details.next} />
      <button type="submit" disabled={pending}>{pending ? "Signing in…" : "Confirm and sign in"}</button>
    </form>
    <p>Only continue if you requested this email. You can close this page otherwise.</p>
  </>;
}
