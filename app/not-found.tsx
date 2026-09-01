import Brand from "../components/Brand";

export default function NotFound() {
  return <main className="systemStatePage">
    <section className="systemStateCard">
      <Brand linked />
      <span className="kicker">Map edge</span>
      <h1>That page isn’t on this atlas</h1>
      <p>The address may have changed, or the page may no longer exist.</p>
      <div className="systemStateActions"><a href="/daily">Play today’s Daily</a><a href="/leaderboard">View leaderboard</a></div>
    </section>
  </main>;
}
