import { notFound } from "next/navigation";
import { animalPreviewEnabled } from "../../lib/animalstatsPreview";
import "../animals/animalstats.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Countries, Animals & Things", robots: { index: false, follow: false }, alternates: { canonical: "/cat" } };
export default function CATPage() {
 if (!animalPreviewEnabled()) notFound();
 return <main className="animalPage catPage"><div className="animalShell">
  <header className="catMasthead"><span className="catMascot" aria-hidden="true"><svg width="76" height="76" viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M16 32 13 9 31 23Q40 19 49 23L67 9 64 32Q72 60 40 65 8 60 16 32Z"/><path d="M26 38v5m28-5v5m-18 6 4 3 4-3m-4 3v6m-9-3q9 7 18 0M8 45l15 3M7 55l16-2m34-5 15-3m-15 8 16 2"/></svg></span><p className="animalEyebrow">AN UNUSUAL COLLECTION OF EVERYDAY WONDER</p><h1><b>C</b>ountries,<br/><b>A</b>nimals &amp; <b>T</b>hings</h1><p>One matching game. Three worlds to get pleasantly lost in.</p></header>
  <section className="catWorlds" aria-label="Choose a world">
   <a href="/daily" className="catWorld catAtlas"><span className="catWorldNumber">01 / THE SURFACE</span><span aria-hidden="true" className="catWorldIcon">◎</span><h2>Countries</h2><p>Open the atlas. Match countries to the statistics that make them remarkable.</p><strong>Explore the world →</strong></a>
   <a href="/animals" className="catWorld catHabitat"><span className="catWorldNumber">02 / THE LIVING WORLD</span><span aria-hidden="true" className="catWorldIcon">❦</span><h2>Animals</h2><p>Into the field. Bears, birds, frogs, sharks, and a few very old clams.</p><strong>Meet the animals →</strong><small>Private playtest</small></a>
   <article id="things" className="catWorld catUnderground"><span className="catWorldNumber">03 / BENEATH THE SURFACE</span><span aria-hidden="true" className="catWorldIcon">◇</span><h2>Things</h2><p>Down into the strata. Minerals, metals, and the matter beneath our feet.</p><strong>Still digging</strong><small>Theme preview. The Things game is not built yet.</small></article>
  </section><p className="catFootnote">A private preview of the CAT family. The public Countries game remains GeoStats.</p>
 </div></main>;
}
