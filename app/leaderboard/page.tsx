import LeaderboardView from "../../components/LeaderboardView";
import AccountControls from "../../components/AccountControls";
import Brand from "../../components/Brand";

export const metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return <main className="shell standalonePage">
    <header>
      <Brand linked />
      <div className="headerButtons"><a className="headerButtonLink" href="/daily">Scout Daily</a><a className="headerButtonLink" href="/daily/adventurer">Adventurer Daily</a><a className="headerButtonLink" href="/daily/expert">Expert Daily</a><AccountControls hideLeaderboardLink /></div>
    </header>
    <LeaderboardView />
  </main>;
}
