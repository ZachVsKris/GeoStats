export default function Loading() {
  return <main className="systemStatePage" aria-busy="true" aria-live="polite">
    <section className="systemStateCard systemLoadingCard"><span className="kicker">GeoStats</span><div className="systemLoadingMark" aria-hidden="true" /><h1>Loading today’s game</h1><p>Getting the country data ready…</p></section>
  </main>;
}
