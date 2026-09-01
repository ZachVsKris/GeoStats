export default function Loading() {
  return <main className="systemStatePage" aria-busy="true" aria-live="polite">
    <section className="systemStateCard systemLoadingCard"><span className="kicker">GeoStats</span><div className="systemLoadingMark" aria-hidden="true" /><h1>Drawing the atlas</h1><p>Loading verified country data…</p></section>
  </main>;
}
