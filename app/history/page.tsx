import Brand from "../../components/Brand";
import AccountControls from "../../components/AccountControls";
import { LEGACY_V16_2_3_ROUND_CONFIGS, ROUND_CONFIGS, type DailyDifficulty } from "../../lib/gameRules";
import { usesCurrentScoreScale } from "../../lib/leaderboardRating";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My results", robots: { index: false, follow: false } };

type SavedResult = {
  challenge_date: string;
  difficulty: DailyDifficulty;
  score: number;
  rules_version: string | null;
};

const PAGE_SIZE = 30;
const STATS_LIMIT = 1000;

function scoreMaximum(result: SavedResult) {
  return usesCurrentScoreScale(result.rules_version)
    ? ROUND_CONFIGS[result.difficulty].maxScore
    : LEGACY_V16_2_3_ROUND_CONFIGS[result.difficulty].maxScore;
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const auth = await createSupabaseServerClient();
  const { data: { user } } = auth ? await auth.auth.getUser() : { data: { user: null } };
  const pageString = (await searchParams).page ?? "1";
  const page = /^\d+$/.test(pageString) ? Math.min(100, Math.max(1, Number(pageString))) : 1;
  let results: SavedResult[] = [];
  let statsResults: SavedResult[] = [];
  let hasMore = false;
  let error = false;

  if (user) {
    const admin = createSupabaseAdminClient();
    if (!admin) error = true;
    else {
      const offset = (page - 1) * PAGE_SIZE;
      const query = () => admin.from("daily_scores")
        .select("challenge_date,difficulty,score,rules_version")
        .eq("user_id", user.id)
        .order("challenge_date", { ascending: false })
        .order("difficulty", { ascending: true });
      const [response, statsResponse] = await Promise.all([
        query().range(offset, offset + PAGE_SIZE),
        query().range(0, STATS_LIMIT),
      ]);
      error = Boolean(response.error || statsResponse.error);
      if (!error) {
        const rows = (response.data ?? []) as SavedResult[];
        hasMore = rows.length > PAGE_SIZE;
        results = rows.slice(0, PAGE_SIZE);
        statsResults = ((statsResponse.data ?? []) as SavedResult[]).slice(0, STATS_LIMIT)
          .filter((row) => Boolean(ROUND_CONFIGS[row.difficulty]));
      }
    }
  }

  return <main className="shell standalonePage infoPage historyPage">
    <header><Brand linked /><div className="headerButtons infoHeaderNav"><a className="headerButtonLink" href="/daily">Play Daily</a>{user && <AccountControls />}</div></header>
    <section className="panel infoPagePanel">
      <div className="infoPageHero"><span className="kicker">Your GeoStats account</span><h1>My results</h1><p>Your completed Dailies, saved across devices.</p></div>
      {!user ? <div className="historyEmpty"><h2>Keep your results</h2><p>Sign in to see the Dailies saved to your account. You can always play without signing in.</p><AccountControls ctaLabel="Sign in / create account" /></div>
        : error ? <div className="historyEmpty" role="alert"><h2>Results unavailable</h2><p>We couldn’t load your saved games right now. Please try again.</p></div>
        : statsResults.length ? <>
          <div className="historyStats" aria-label="Personal statistics">
            <div className="historyStatTotal"><strong>{statsResults.length}{statsResults.length > STATS_LIMIT ? "+" : ""}</strong><span>Saved Dailies</span></div>
            {(["easy", "normal", "expert"] as const).map((difficulty) => {
              const games = statsResults.filter((result) => result.difficulty === difficulty);
              if (!games.length) return null;
              const average = Math.round(games.reduce((sum, result) => sum + result.score / scoreMaximum(result), 0) / games.length * 100);
              const best = Math.round(Math.max(...games.map((result) => result.score / scoreMaximum(result))) * 100);
              return <div className="historyStatMode" key={difficulty}>
                <h2>{ROUND_CONFIGS[difficulty].label}</h2>
                <dl><div><dt>Games</dt><dd>{games.length}</dd></div><div><dt>Average</dt><dd>{average}%</dd></div><div><dt>Best</dt><dd>{best}%</dd></div></dl>
              </div>;
            })}
          </div>
          {statsResults.length === STATS_LIMIT && <p className="historyStatsNote">Stats are based on your latest {STATS_LIMIT} saved Dailies.</p>}
          <h2 className="historyListHeading">Saved results</h2>
          <div className="historyList" aria-label="Saved Daily results">
            {results.map((result) => {
              const config = ROUND_CONFIGS[result.difficulty];
              if (!config) return null;
              const maximum = scoreMaximum(result);
              return <div className="historyRow" key={`${result.challenge_date}-${result.difficulty}`}>
                <time dateTime={result.challenge_date}>{result.challenge_date}</time>
                <strong>{config.label}</strong>
                <span>{result.score} <small>/ {maximum}</small></span>
              </div>;
            })}
          </div>
          <nav className="historyPagination" aria-label="Results pages">
            {page > 1 && <a href={page === 2 ? "/history" : `/history?page=${page - 1}`}>← Newer results</a>}
            {hasMore && <a href={`/history?page=${page + 1}`}>Older results →</a>}
          </nav>
        </> : <div className="historyEmpty"><h2>No saved Dailies yet</h2><p>Finish a Daily and your result will appear here automatically.</p><a href="/daily">Play today’s game</a></div>}
    </section>
  </main>;
}
