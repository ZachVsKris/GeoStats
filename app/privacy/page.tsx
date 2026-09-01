import Brand from "../../components/Brand";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return <main className="shell standalonePage infoPage">
    <header>
      <Brand linked />
      <div className="headerButtons infoHeaderNav"><a className="headerButtonLink" href="/daily">Play Daily</a><a className="headerButtonLink" href="/data">Data &amp; sources</a><a className="headerButtonLink" href="/terms">Terms</a></div>
    </header>
    <section className="panel infoPagePanel">
      <div className="infoPageHero"><span className="kicker">Your data</span><h1>Privacy</h1><p>GeoStats collects only the information needed to operate the game, accounts, leaderboards, and limited first-party product analytics.</p></div>
      <div className="infoDocument">
        <p>GeoStats is a geography game built around public country statistics. Scout and Adventurer can be played without creating an account; anyone may preview the Expert board.</p>
        <h2>Accounts and leaderboards</h2>
        <p>Anyone may view the leaderboards. An account is required to play Expert, save verified Daily scores, or appear in the standings. If you sign in, GeoStats stores the information needed to authenticate you, your GeoStats username, and your saved Daily scores. Public leaderboards show your GeoStats username, never your email address.</p>
        <h2>First-party analytics</h2>
        <p>GeoStats records limited first-party product analytics such as page views, game starts and completions, difficulty, coarse referrer hostname, campaign parameters you arrived with, and whether the same browser has visited before. Analytics uses a session identifier and does not intentionally collect precise location, advertising identifiers, or cross-site browsing history.</p>
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
