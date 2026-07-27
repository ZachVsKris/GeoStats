import { CATEGORIES, type Category } from "../../lib/categories";
import { loadServerPlayableCategoryCatalog } from "../../lib/serverPlayableCatalog";
import { DATASET_VERSION, RULES_VERSION } from "../../lib/version";
import { categoryMethodologyUrl, categorySourceUrl, SOURCE_REGISTRY } from "../../lib/sourceRegistry";

export const dynamic = "force-dynamic";

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
  const staticQuarantined=CATEGORIES.filter((category)=>category.trustStatus==="quarantined" || category.enabled===false);
  return <main style={{maxWidth:1000,margin:"40px auto",padding:20}}>
    <h1>Data, sources & trust</h1>
    <p>Dataset release: {DATASET_VERSION}. Rules version: {RULES_VERSION}. GeoStats includes only objective, measurable country characteristics. Perception rankings, subjective judgments, and opaque composite scores are blocked.</p>
    <p>Every playable category must pass coverage, freshness, distribution, provenance, credibility, verifiability, understandability, fun, duplicate, and editorial-review gates. Newly imported candidates remain disabled until approved.</p>
    <p>On result screens, <strong>Data & Source</strong> shows the category definition, comparison year, searchable global ranking, and a direct source-material link.</p>
    <p><strong>{categories.length}</strong> verified categories are currently available to the board generator{warehouseLoaded ? " from the live warehouse catalog" : ". The live verified catalog is currently unavailable; GeoStats does not fall back to unverified bundled gameplay data"}. The bundled rules also identify <strong>{staticQuarantined.length}</strong> explicit disabled or quarantined categories.</p>
    <p><a href="/daily">Back to game</a> · <a href="/audit">Open trust audit</a></p>
    {categories.map((category)=>{
      const indicator=category.warehouseSourceIndicatorCode ?? category.indicator;
      const source=category.exactQueryUrl ?? category.downloadUrl ?? category.sourceUrl ?? categorySourceUrl(category.source,indicator);
      const methodology=category.methodologyUrl ?? categoryMethodologyUrl(category.source,indicator);
      return <section key={category.id} style={{padding:"14px 0",borderBottom:"1px solid #333",opacity:category.enabled===false?.62:1}}>
        <h2>{category.icon} {category.name}</h2>
        <p>{category.plainLanguageDescription ?? category.description}</p>
        <code>{indicator}</code> · {category.direction === "high" ? "highest wins" : "lowest wins"} · {category.unit}<br/>
        <small>{SOURCE_REGISTRY[category.source].name} · credibility {score(category.credibilityScore)} · verifiability {score(category.verifiabilityScore)} · clarity {score(category.understandabilityScore)} · fun {score(category.funScore)} · {category.evidenceLabel ?? "internationally harmonized"}</small>
        {category.trustReason&&<p><strong>Why trusted:</strong> {category.trustReason}</p>}
        {category.playerQualityReason&&<p><strong>Why playable:</strong> {category.playerQualityReason}</p>}
        <div><a href={source} target="_blank" rel="noreferrer">Best available source link ↗</a> · <a href={methodology} target="_blank" rel="noreferrer">Methodology ↗</a></div>
      </section>;
    })}
  </main>;
}
