import { CATEGORIES, type Category } from "../../lib/categories";
import { loadServerPlayableCategoryCatalog } from "../../lib/serverPlayableCatalog";
import { SOURCE_REGISTRY } from "../../lib/sourceRegistry";
import { resolvePlayerSourceUrl } from "../../lib/playerSourceLinks";

export const dynamic = "force-dynamic";

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
  return <main style={{maxWidth:1100,margin:"40px auto",padding:20}}>
    <h1>Category credibility audit</h1>
    <p>GeoStats does not reject a statistic merely because a result is surprising. It excludes categories when national definitions, incentives, reporting systems, or imputation make country rankings insufficiently comparable. Independently compiled surprising facts can remain, but the evidence type and reasoning are disclosed.</p>
    <p>Internet-use percentage is quarantined pending independent corroboration. Scientific-journal article counts remain because the World Bank series is based on independent bibliometric records rather than a country&apos;s own publication claim; the category measures volume, not research quality.</p>
    <p>Only the live source-verified warehouse catalog is treated as approved. GeoStats does not fall back to bundled categories for gameplay when the verified catalog is unavailable. Explicit bundled quarantines are included so players can see why prominent rejected categories are absent.</p>
    <p><a href="/daily">Back to game</a> · <a href="/data">Data and methodology</a></p>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:14}}>
      {categories.map((category)=>{
        const indicator=category.warehouseSourceIndicatorCode ?? category.indicator;
        const exactSource=resolvePlayerSourceUrl({
          source: category.source,
          indicator,
          playerSourceUrl: category.playerSourceUrl,
          playerSourceStatus: category.playerSourceStatus,
        });
        return <article key={category.id} style={{border:`1px solid ${category.trustStatus==="quarantined"?"#8b554d":"#294a3d"}`,borderRadius:14,padding:16,background:"#0c211a",opacity:category.enabled===false?.7:1}}>
          <h2 style={{fontSize:18}}>{category.icon} {category.name}</h2>
          <p>{category.description}</p>
          <p><strong>{SOURCE_REGISTRY[category.source].name}</strong><br/>Credibility: {category.credibilityScore ?? "reviewed"}/100 · {category.trustStatus ?? "approved"}<br/>Evidence: {category.evidenceLabel ?? "Internationally harmonized"}</p>
          <p>{category.trustReason ?? "Passed the GeoStats credibility and provenance review."}</p>
          <code style={{display:"inline-block",marginTop:10}}>{indicator}</code>
          {exactSource ? <div><a href={exactSource} target="_blank" rel="noreferrer" style={{color:"#b9f45a"}}>View exact official data ↗</a></div> : <p><strong>Exact external data page:</strong> unavailable. The category remains blocked from Daily boards.</p>}
        </article>;
      })}
    </div>
  </main>;
}
