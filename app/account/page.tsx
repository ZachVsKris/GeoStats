import Brand from "../../components/Brand";
import AccountControls from "../../components/AccountControls";
import PersonalResults from "../../components/PersonalResults";

export const metadata = { title: "My Stats", robots: { index: false, follow: false } };

export default function AccountPage() {
  return <main className="shell standalonePage"><header><Brand linked /><div className="headerButtons"><a className="headerButtonLink" href="/daily">Play Daily</a><AccountControls hideLeaderboardLink /></div></header><PersonalResults /></main>;
}
