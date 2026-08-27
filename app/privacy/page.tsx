export const metadata = { title: "Privacy | GeoStats" };

export default function Privacy() {
  return <main style={{maxWidth:780,margin:"40px auto",padding:20,lineHeight:1.65}}>
    <h1>Privacy</h1>
    <p>GeoStats is a geography game built around public country statistics. You can play the Daily without creating an account.</p>
    <h2>Accounts and leaderboards</h2>
    <p>If you sign in, GeoStats stores the account information needed to authenticate you, your GeoStats username, and your saved Daily scores. Public leaderboards show your GeoStats username, not your email address or display name. Random QA games are private to authorized tester accounts and are not included in public standings.</p>
    <h2>First-party analytics</h2>
    <p>GeoStats records limited first-party product analytics such as page views, game starts and completions, difficulty, coarse referrer hostname, campaign parameters you arrived with, and whether the same browser has visited before. Analytics uses a session identifier and does not intentionally collect precise location, advertising identifiers, or cross-site browsing history. Internal Random QA activity is excluded.</p>
    <h2>Technical logs</h2>
    <p>Hosting and database providers may process normal technical information such as IP address, browser type, request time, and security logs to operate and protect the service.</p>
    <h2>Data sources</h2>
    <p>Country statistics shown in GeoStats come from public or licensed source organizations. Opening a source link takes you to that provider, whose own privacy practices apply.</p>
    <p><a href="/">Back to GeoStats</a></p>
  </main>;
}
