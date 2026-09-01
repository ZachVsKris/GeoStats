"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main className="systemStatePage"><section className="systemStateCard" role="alert">
    <span className="kicker">GeoStats</span><h1>Something interrupted the atlas</h1><p>Try restoring the application. No score is submitted unless GeoStats confirms it.</p>
    <div className="systemStateActions"><button type="button" onClick={reset}>Restore GeoStats</button><a href="/daily">Return to Daily</a></div>
  </section></main></body></html>;
}
