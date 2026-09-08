import type { Metadata } from "next";
import EmailConfirmation from "../../../components/EmailConfirmation";

export const metadata: Metadata = {
  title: "Confirm sign-in | GeoStats",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

// A GET never consumes the one-time token. Email scanners can open this page safely.
export default function EmailSignInPage() {
  return <main className="authCallbackPage"><section className="authCallbackCard">
    <span className="kicker">GeoStats account</span>
    <h1>Continue to GeoStats</h1>
    <EmailConfirmation />
  </section></main>;
}
