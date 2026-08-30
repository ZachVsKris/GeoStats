import LeaderboardView from "../../components/LeaderboardView";
import AccountControls from "../../components/AccountControls";
import { createSupabaseServerClient } from "../../lib/supabase/server";

export const metadata = { title: "Leaderboard | GeoStats" };

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const auth = await createSupabaseServerClient();
  const userResult = auth ? await auth.auth.getUser() : null;
  const signedIn = Boolean(userResult?.data.user);
  return <main className="shell standalonePage">
    <header>
      <a href="/daily" className="brand brandLink"><span className="logo">🌍</span><div><h1>GeoStats</h1><p>Geography, with strategy.</p></div></a>
      <div className="headerButtons"><a className="headerButtonLink" href="/daily">Scout Daily</a><a className="headerButtonLink" href="/daily/adventurer">Adventurer Daily</a><a className="headerButtonLink" href="/daily/expert">Expert Daily</a>{signedIn && <AccountControls hideLeaderboardLink />}</div>
    </header>
    {signedIn ? <LeaderboardView /> : <section className="leaderboardPage panel leaderboardAccessGate">
      <div className="leaderboardPageIntro">
        <span className="kicker">Account-only standings</span>
        <h1>Leaderboard</h1>
        <p>Leaderboard access is reserved for GeoStats account holders so every displayed score is tied to one verified player and one Daily attempt.</p>
      </div>
      <div className="leaderboardGateBody">
        <strong>Create a free account to view the standings</strong>
        <p>You’ll also unlock Expert Daily play, save verified scores across all three modes, and compete under a public GeoStats username. Your email stays private.</p>
        <AccountControls context="leaderboard" ctaLabel="Sign in to view leaderboard" hideLeaderboardLink />
        <small>Scout and Adventurer remain playable without an account.</small>
      </div>
    </section>}
  </main>;
}
