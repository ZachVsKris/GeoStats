export const metadata = { title: "Privacy | GeoStats" };

export default function Privacy() {
  return <main className="shell standalonePage infoPage">
    <header>
      <a href="/daily" className="brand brandLink"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></a>
      <div className="headerButtons infoHeaderNav"><a className="headerButtonLink" href="/daily">Play Daily</a><a className="headerButtonLink" href="/data">Data &amp; sources</a><a className="headerButtonLink" href="/terms">Terms</a></div>
    </header>
    <section className="panel infoPagePanel">
      <div className="infoPageHero"><span className="kicker">Your data</span><h1>Privacy</h1><p>GeoStats collects only the information needed to operate the game, accounts, leaderboards, and limited first-party product analytics.</p></div>
      <div className="infoDocument">
        <p>GeoStats is a geography game built around public country statistics. You can play the Daily without creating an account.</p>
        <h2>Accounts and leaderboards</h2>
        <p>If you sign in, GeoStats stores the account information needed to authenticate you, your GeoStats username, and your saved Daily scores. Public leaderboards show your GeoStats username, not your email address or display name. Random QA games are private to authorized tester accounts and are not included in public standings.</p>
        <h2>First-party analytics</h2>
        <p>GeoStats records limited first-party product analytics such as page views, game starts and completions, difficulty, coarse referrer hostname, campaign parameters you arrived with, and whether the same browser has visited before. Analytics uses a session identifier and does not intentionally collect precise location, advertising identifiers, or cross-site browsing history. Internal Random QA activity is excluded.</p>
        <h2>Technical logs</h2>
        <p>Hosting and database providers may process normal technical information such as IP address, browser type, request time, and security logs to operate and protect the service.</p>
        <h2>Data sources</h2>
        <p>Country statistics shown in GeoStats come from public or licensed source organizations. Opening a source link takes you to that provider, whose own privacy practices apply.</p>
      </div>
      <div className="infoActions"><a href="/daily">Back to GeoStats</a><a href="/terms">Read the Terms</a></div>
      <footer className="infoFooter"><span>GeoStats · privacy</span><nav><a href="/data">Data</a><a href="/audit">Audit</a><a href="/terms">Terms</a></nav></footer>
    </section>
  </main>;
}
