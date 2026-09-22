import LeaderboardView from "../../components/LeaderboardView";
import AccountControls from "../../components/AccountControls";
import Brand from "../../components/Brand";

export const metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return <main className="shell standalonePage">
    <header>
      <Brand linked />
      <div className="headerButtons"><nav className="leaderboardGameNav" aria-label="Play GeoStats"><a className="headerButtonLink" href="/daily">Scout</a><a className="headerButtonLink" href="/daily/adventurer">Adventurer</a><a className="headerButtonLink" href="/daily/expert">Expert</a><a className="headerButtonLink active" href="/leaderboard" aria-current="page">Leaderboard</a></nav><AccountControls hideLeaderboardLink /></div>
    </header>
    <LeaderboardView />
  </main>;
}
