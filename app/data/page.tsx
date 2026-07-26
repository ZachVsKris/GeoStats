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
    return { categories: CATEGORIES.filter((category) => category.enabled !== false), warehouseLoaded: false };
  }
}

export default async function DataPage(){
  const { categories, warehouseLoaded } = await loadCatalog();
  const staticQuarantined=CATEGORIES.filter((category)=>category.trustStatus==="quarantined" || category.enabled===false);
  return <main style={{maxWidth:1000,margin:"40px auto",padding:20}}>
    <h1>Data, sources & trust</h1>
    <p>Dataset release: {DATASET_VERSION}. Rules version: {RULES_VERSION}. GeoStats separates statistical quality from credibility: a category must pass coverage, freshness, distribution, provenance, comparability, and editorial review before it can enter Daily or Random boards.</p>
    <p>Results use the exact source URL and methodology URL stored with each warehouse category. Registry links are used only when stored metadata is unavailable.</p>
    <p><strong>{categories.length}</strong> trusted categories are currently available to the board generator{warehouseLoaded ? " from the live warehouse catalog" : " from the bundled fallback catalog"}. The bundled rules also identify <strong>{staticQuarantined.length}</strong> explicit disabled or quarantined categories.</p>
    <p><a href="/daily">Back to game</a> · <a href="/audit">Open trust audit</a></p>
    {categories.map((category)=><section key={category.id} style={{padding:"14px 0",borderBottom:"1px solid #333",opacity:category.enabled===false?.62:1}}>
      <h2>{category.icon} {category.name}</h2><p>{category.description}</p>
      <code>{category.warehouseSourceIndicatorCode ?? category.indicator}</code> · {category.direction === "high" ? "highest wins" : "lowest wins"} · {category.unit}<br/>
      <small>{SOURCE_REGISTRY[category.source].name} · credibility {category.credibilityScore ?? "reviewed"}/100 · {category.evidenceLabel ?? "internationally harmonized"} · {category.trustStatus ?? "approved"}</small>
      {category.trustReason&&<p><strong>Why trusted:</strong> {category.trustReason}</p>}
      <div><a href={category.sourceUrl ?? categorySourceUrl(category.source,category.warehouseSourceIndicatorCode ?? category.indicator)} target="_blank" rel="noreferrer">Source ↗</a> · <a href={category.methodologyUrl ?? categoryMethodologyUrl(category.source,category.warehouseSourceIndicatorCode ?? category.indicator)} target="_blank" rel="noreferrer">Methodology ↗</a></div>
    </section>)}
  </main>;
}
