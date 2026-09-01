import { CATEGORIES, type Category } from "../../lib/categories";
import { loadServerPlayableCategoryCatalog } from "../../lib/serverPlayableCatalog";
import { DATASET_VERSION, RULES_VERSION } from "../../lib/version";
import { SOURCE_REGISTRY } from "../../lib/sourceRegistry";
import { resolvePlayerSourceUrl } from "../../lib/playerSourceLinks";
import Brand from "../../components/Brand";
import { publicCatalogPresentation } from "../../lib/publicCatalogPresentation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data & sources" };

async function loadCatalog(): Promise<{ categories: Category[]; warehouseLoaded: boolean }> {
  try {
    const categories = await loadServerPlayableCategoryCatalog();
    return { categories, warehouseLoaded: true };
  } catch {
    return { categories: [], warehouseLoaded: false };
  }
}

function score(value?: number) {
  return value == null ? "reviewed" : `${value}/100`;
}

export default async function DataPage(){
  const { categories, warehouseLoaded } = await loadCatalog();
  const staticQuarantined=publicCatalogPresentation(categories,CATEGORIES).blocked;
  return <main className="shell standalonePage infoPage">
    <header>
      <Brand linked />
      <div className="headerButtons infoHeaderNav"><a className="headerButtonLink" href="/daily">Play Daily</a><a className="headerButtonLink" href="/leaderboard">Leaderboard</a><a className="headerButtonLink" href="/audit">Trust audit</a></div>
    </header>

    <section className="panel infoPagePanel">
      <div className="infoPageHero">
        <span className="kicker">Source transparency</span>
        <h1>Data, sources &amp; trust</h1>
        <p>Every playable GeoStats category is tied to a documented source, a defined measure, and a comparable country ranking.</p>
      </div>

      <div className="infoStats" aria-label="Data catalog summary">
        <div className="infoStat"><strong>{categories.length}</strong><span>Verified playable categories</span></div>
        <div className="infoStat"><strong>{staticQuarantined.length}</strong><span>Explicitly blocked or quarantined</span></div>
        <div className="infoStat"><strong>{warehouseLoaded ? "Live" : "Unavailable"}</strong><span>Verified warehouse catalog</span></div>
      </div>

      <div className="infoProse">
        <p>Dataset release: <strong>{DATASET_VERSION}</strong>. Rules version: <strong>{RULES_VERSION}</strong>. GeoStats includes only objective, measurable country characteristics. Perception rankings, subjective judgments, and opaque composite scores are blocked.</p>
        <p>Every playable category must pass coverage, freshness, distribution, provenance, credibility, verifiability, understandability, fun, duplicate, and editorial-review gates. Newly imported candidates remain disabled until approved.</p>
        <p>Daily boards also require distinct semantic families, so near-duplicate concepts cannot appear together. The best country shown for every category must rank within the verified global top 20.</p>
        <p>On result screens, <strong>Data &amp; Source</strong> shows the category definition, reference period, searchable global ranking, and a verified human-readable official source page. Exact data views are preferred; safe general official portals are clearly labeled. Raw APIs and file downloads are never shown to players.</p>
        {!warehouseLoaded && <p><strong>The live verified catalog is currently unavailable.</strong> GeoStats does not fall back to unverified bundled gameplay data.</p>}
      </div>

      <div className="infoActions"><a href="/daily">Back to the game</a><a href="/audit">Open the trust audit</a></div>

      <div className="infoSectionHeading"><div><span className="kicker">Playable catalog</span><h2>Verified categories</h2></div><span>{categories.length} categories in the live generator</span></div>
      <div className="infoCatalogGrid">
        {categories.map((category)=>{
          const indicator=category.warehouseSourceIndicatorCode ?? category.indicator;
          const source=resolvePlayerSourceUrl({
            source: category.source,
            indicator,
            playerSourceUrl: category.playerSourceUrl,
            playerSourceStatus: category.playerSourceStatus,
            sourcePageUrl: category.sourcePageUrl,
            sourceUrl: category.sourceUrl,
            methodologyUrl: category.methodologyUrl,
          });
          const exactSource = category.source === "worldbank" || category.playerSourceStatus === "exact";
          return <article className={`infoCard ${category.enabled===false ? "infoCardMuted" : ""}`} key={category.id}>
            <div className="infoCardHeader"><h2>{category.icon} {category.name}</h2><span className="sourceBadge">{SOURCE_REGISTRY[category.source].name}</span></div>
            <p className="infoCardDescription">{category.plainLanguageDescription ?? category.description}</p>
            <div className="infoCardMeta"><span>{category.direction === "high" ? "Highest wins" : "Lowest wins"}</span><span>{category.unit}</span></div>
            <code className="infoCode">{indicator}</code>
            <small className="infoCardEvidence">Credibility {score(category.credibilityScore)} · verifiability {score(category.verifiabilityScore)} · clarity {score(category.understandabilityScore)} · fun {score(category.funScore)} · {category.evidenceLabel ?? "internationally harmonized"}</small>
            {category.trustReason&&<p className="infoCardReason"><strong>Why trusted:</strong> {category.trustReason}</p>}
            {category.playerQualityReason&&<p className="infoCardReason"><strong>Why playable:</strong> {category.playerQualityReason}</p>}
            {source ? <a className="infoSourceLink" href={source} target="_blank" rel="noreferrer">{exactSource ? "View exact official data ↗" : "Open official data source ↗"}</a> : <p className="infoCardReason"><strong>Official source unavailable.</strong> This category is not eligible for Daily boards.</p>}
          </article>;
        })}
      </div>
      <footer className="infoFooter"><span>GeoStats · official-source geography</span><nav><a href="/audit">Audit</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>
    </section>
  </main>;
}
