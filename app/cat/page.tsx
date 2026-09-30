import { CATLogo, CATMascot } from "../../components/CATBrand";
import { notFound } from "next/navigation";
import { animalPreviewEnabled } from "../../lib/animalstatsPreview";
import "../animals/animalstats.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Countries, Animals & Things", robots: { index: false, follow: false }, alternates: { canonical: "/cat" } };
export default function CATPage() {
 if (!animalPreviewEnabled()) notFound();
 return <main className="animalPage catPage"><div className="animalShell">
  <header className="catMasthead"><CATMascot /><p className="animalEyebrow">AN INDEX OF COUNTRIES, CREATURES &amp; OTHER ODDITIES</p><CATLogo /><h1><b>C</b>ountries,<br/><b>A</b>nimals &amp; <b>T</b>hings</h1><p>A curious little collection. One matching game, three worlds.</p></header>
  <section className="catWorlds" aria-label="Choose a world">
   <a href="/daily" className="catWorld catAtlas"><span className="catWorldNumber">01 / THE SURFACE</span><span aria-hidden="true" className="catWorldIcon">◎</span><h2>Countries</h2><p>Open the atlas. Match countries to the statistics that make them remarkable.</p><strong>Explore the world →</strong></a>
   <a href="/animals" className="catWorld catHabitat"><span className="catWorldNumber">02 / THE LIVING WORLD</span><span aria-hidden="true" className="catWorldIcon">❦</span><h2>Animals</h2><p>Into the field. Bears, birds, frogs, sharks, and a few very old clams.</p><strong>Meet the animals →</strong><small>Private playtest</small></a>
   <article id="things" className="catWorld catUnderground"><span className="catWorldNumber">03 / BENEATH THE SURFACE</span><span aria-hidden="true" className="catWorldIcon">◇</span><h2>Things</h2><p>Down into the strata. Minerals, metals, and the matter beneath our feet.</p><strong>Still digging</strong><small>Theme preview. The Things game is not built yet.</small></article>
  </section><p className="catFootnote">A private preview of the CAT family. The public Countries game remains GeoStats.</p>
 </div></main>;
}
