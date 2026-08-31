export const metadata = { title: "Terms | GeoStats" };

export default function Terms() {
  return <main className="shell standalonePage infoPage">
    <header>
      <a href="/daily" className="brand brandLink"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></a>
      <div className="headerButtons infoHeaderNav"><a className="headerButtonLink" href="/daily">Play Daily</a><a className="headerButtonLink" href="/data">Data &amp; sources</a><a className="headerButtonLink" href="/privacy">Privacy</a></div>
    </header>
    <section className="panel infoPagePanel">
      <div className="infoPageHero"><span className="kicker">Using GeoStats</span><h1>Terms</h1><p>GeoStats is an educational geography game built around documented country statistics and competitive Daily play.</p></div>
      <div className="infoDocument">
        <p>GeoStats is provided as-is and may change as source agencies revise their data or methodologies.</p>
        <h2>Statistics and rankings</h2>
        <p>GeoStats validates categories against documented sources and preserves the source/reference information used for play, but no statistical dataset is error-free or permanent. Rankings are for gameplay and learning; they should not be relied on for legal, financial, medical, safety, or public-policy decisions.</p>
        <h2>Accounts</h2>
        <p>Anyone may view the leaderboards. An account is required for Expert play, verified score saving, and appearing in the standings. You are responsible for activity on your account. Usernames may be rejected or removed when they impersonate GeoStats, contain abusive language, or interfere with the service.</p>
        <h2>Fair play</h2>
        <p>Do not manipulate score submissions, interfere with other players, probe private administrative functionality, or use automated traffic in a way that disrupts the service. GeoStats may remove invalid scores or restrict abusive access.</p>
        <h2>Source rights</h2>
        <p>Underlying datasets and reference materials remain subject to the rights and terms of their respective publishers. GeoStats source links identify the provider used for each category.</p>
      </div>
      <div className="infoActions"><a href="/daily">Back to GeoStats</a><a href="/privacy">Read Privacy</a></div>
      <footer className="infoFooter"><span>GeoStats · terms</span><nav><a href="/data">Data</a><a href="/audit">Audit</a><a href="/privacy">Privacy</a></nav></footer>
    </section>
  </main>;
}
