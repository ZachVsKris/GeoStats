"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("GeoStats route error", error); }, [error]);
  return <main className="systemStatePage">
    <section className="systemStateCard" role="alert">
      <span className="kicker">Route interrupted</span>
      <h1>This page couldn’t be drawn</h1>
      <p>Your game data has not been changed. Try loading this page once more.</p>
      <div className="systemStateActions"><button type="button" onClick={reset}>Try again</button><a href="/daily">Return to Daily</a></div>
    </section>
  </main>;
}
