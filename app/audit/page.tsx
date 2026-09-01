import { CATEGORIES, type Category } from "../../lib/categories";
import { loadServerPlayableCategoryCatalog } from "../../lib/serverPlayableCatalog";
import { SOURCE_REGISTRY } from "../../lib/sourceRegistry";
import { resolvePlayerSourceUrl } from "../../lib/playerSourceLinks";
import Brand from "../../components/Brand";

export const dynamic = "force-dynamic";
export const metadata = { title: "Category trust audit" };

async function loadAuditCatalog(): Promise<Category[]> {
  let approved: Category[];
  try {
    approved = await loadServerPlayableCategoryCatalog();
  } catch {
    approved = [];
  }
  const quarantined = CATEGORIES.filter((category) => category.trustStatus === "quarantined" || category.enabled === false);
  const merged = new Map<string, Category>();
  for (const category of [...approved, ...quarantined]) merged.set(category.id, category);
  return [...merged.values()].sort((a,b) => {
    const aBlocked = a.trustStatus === "quarantined" || a.enabled === false ? 0 : 1;
    const bBlocked = b.trustStatus === "quarantined" || b.enabled === false ? 0 : 1;
    return aBlocked - bBlocked || a.name.localeCompare(b.name);
  });
}

export default async function AuditPage(){
  const categories = await loadAuditCatalog();
  const blockedCount = categories.filter((category) => category.trustStatus === "quarantined" || category.enabled === false).length;
  const approvedCount = Math.max(0, categories.length - blockedCount);
  return <main className="shell standalonePage infoPage">
    <header>
      <Brand linked />
      <div className="headerButtons infoHeaderNav"><a className="headerButtonLink" href="/daily">Play Daily</a><a className="headerButtonLink" href="/leaderboard">Leaderboard</a><a className="headerButtonLink" href="/data">Data &amp; sources</a></div>
    </header>

    <section className="panel infoPagePanel">
      <div className="infoPageHero">
        <span className="kicker">Editorial governance</span>
        <h1>Category credibility audit</h1>
        <p>Surprising statistics are welcome. Incomparable, opaque, misleading, or weakly sourced statistics are not.</p>
      </div>

      <div className="infoStats" aria-label="Category audit summary">
        <div className="infoStat"><strong>{approvedCount}</strong><span>Approved in this audit view</span></div>
        <div className="infoStat"><strong>{blockedCount}</strong><span>Blocked or quarantined</span></div>
        <div className="infoStat"><strong>{categories.length}</strong><span>Total records shown</span></div>
      </div>

      <div className="infoProse">
        <p>GeoStats does not reject a statistic merely because a result is surprising. It excludes categories when national definitions, incentives, reporting systems, or imputation make country rankings insufficiently comparable. Independently compiled surprising facts can remain, but the evidence type and reasoning are disclosed.</p>
        <p>Internet-use percentage is quarantined pending independent corroboration. Scientific-journal article counts remain because the World Bank series is based on independent bibliometric records rather than a country&apos;s own publication claim; the category measures volume, not research quality.</p>
        <p>Only the live source-verified warehouse catalog is treated as approved. GeoStats does not fall back to bundled categories for gameplay when the verified catalog is unavailable. Explicit bundled quarantines are included so players can see why prominent rejected categories are absent.</p>
      </div>
      <div className="infoActions"><a href="/daily">Back to the game</a><a href="/data">Data and methodology</a></div>

      <div className="infoSectionHeading"><div><span className="kicker">Audit trail</span><h2>Category decisions</h2></div><span>Blocked records appear first</span></div>
      <div className="infoCatalogGrid">
        {categories.map((category)=>{
          const blocked = category.trustStatus === "quarantined" || category.enabled === false;
          const indicator=category.warehouseSourceIndicatorCode ?? category.indicator;
          const playerSource=resolvePlayerSourceUrl({
            source: category.source,
            indicator,
            playerSourceUrl: category.playerSourceUrl,
            playerSourceStatus: category.playerSourceStatus,
            sourcePageUrl: category.sourcePageUrl,
            sourceUrl: category.sourceUrl,
            methodologyUrl: category.methodologyUrl,
          });
          const exactSource = category.source === "worldbank" || category.playerSourceStatus === "exact";
          return <article className={`infoCard ${blocked ? "infoCardBlocked" : ""}`} key={category.id}>
            <div className="infoCardHeader"><h2>{category.icon} {category.name}</h2><span className={`infoStatusPill ${blocked ? "blocked" : "approved"}`}>{blocked ? "Blocked" : "Approved"}</span></div>
            <p className="infoCardDescription">{category.plainLanguageDescription ?? category.description}</p>
            <div className="infoCardMeta"><span>{SOURCE_REGISTRY[category.source].name}</span><span>{category.credibilityScore == null ? "Credibility reviewed" : `Credibility ${category.credibilityScore}/100`}</span></div>
            <small className="infoCardEvidence">Evidence: {category.evidenceLabel ?? "Internationally harmonized"}</small>
            <p className="infoCardReason">{category.trustReason ?? "Passed the GeoStats credibility and provenance review."}</p>
            <code className="infoCode">{indicator}</code>
            {playerSource ? <a className="infoSourceLink" href={playerSource} target="_blank" rel="noreferrer">{exactSource ? "View exact official data ↗" : "Open official data source ↗"}</a> : <p className="infoCardReason"><strong>Official source unavailable.</strong> The category remains blocked from Daily boards.</p>}
          </article>;
        })}
      </div>
      <footer className="infoFooter"><span>GeoStats · category governance</span><nav><a href="/data">Data</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>
    </section>
  </main>;
}
