"use client";
import { indexApprovedAnimalValues } from "../lib/animalstatsRanking";
import { animalMajorGroup, animalComparisonScope } from "../lib/animalstatsCoverage";
import { useMemo, useState } from "react";
import type { AnimalDataset, BoardCandidate, Trait } from "../lib/animalstats";
import { AnimalSourcePanel } from "./AnimalResults";
import { formatAnimalValue } from "../lib/animalstatsFormatting";

export default function AnimalDataBrowser({ data, boards, initialTab, onPlay }: { data: AnimalDataset; boards: BoardCandidate[]; initialTab: "categories" | "animals"; onPlay: (id: string) => void }) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [group, setGroup] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 50;
  const [sourceTrait, setSourceTrait] = useState<Trait | null>(null);
  const used = useMemo(() => new Set(boards.flatMap(b => b.traitIds)), [boards]);
  const traits = useMemo(() => data.traits.filter(t => t.oneSided ? used.has(t.id) : t.direction === "higher_wins" && (used.has(t.id) || used.has(t.counterTraitId ?? ""))).sort((a, b) => a.displayName.localeCompare(b.displayName)), [data.traits, used]);
  const observations = useMemo(() => indexApprovedAnimalValues(data.values), [data.values]);
  const animalMeasurements = useMemo(() => {
    const rows = new Map<string, {t: Trait; v: AnimalDataset["values"][number]}[]>();
    for (const t of traits) for (const v of observations.get(t.id) ?? []) {
      const list = rows.get(v.animalId);
      if (list) list.push({t, v}); else rows.set(v.animalId, [{t, v}]);
    }
    return rows;
  }, [traits, observations]);
  const prizeNames = useMemo(() => new Set(data.traits.filter(t => used.has(t.id)).map(t => t.displayName)).size, [data.traits, used]);
  const allTraits = useMemo(() => new Map(data.traits.map(t => [t.id, t])), [data.traits]);
  const sources = useMemo(() => new Map(data.sources.map(s => [s.id, s])), [data.sources]);
  const roundAnimals = useMemo(() => new Set(boards.flatMap(board => board.animalIds)), [boards]);
  const animalGroup = (animal: AnimalDataset["animals"][number]) => animal.entityType === "breed" ? animal.taxonomicGroup : animalMajorGroup(animal);
  const groups = [...new Set(data.animals.map(animalGroup))].sort();
  const groupNames: Record<string, string> = {mammals: "Mammals", bird: "Birds", reptiles: "Reptiles", amphibians: "Amphibians", fish: "Fish", insect: "Insects", molluscs: "Molluscs", crustacean: "Crustaceans", echinoderm: "Starfish & other echinoderms", cnidarian: "Jellyfish & corals", chelicerate: "Horseshoe crabs & other chelicerates", "dog-breed": "Dog breeds", "cat-breed": "Cat breeds", "extinct-mammal": "Extinct mammals", dinosaur: "Dinosaurs"};
  const filteredAnimals = data.animals.filter(animal =>
    (group === "all" || animalGroup(animal) === group) &&
    (availability === "all" || roundAnimals.has(animal.id) === (availability === "playable")) &&
    `${animal.commonName} ${animal.scientificName} ${animal.taxonomicGroup}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filteredAnimals.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleAnimals = filteredAnimals.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  return <section className="panel animalDataBrowser"><h2>Data &amp; methodology</h2><nav className="personalModeTabs" aria-label="Animal data"><button onClick={() => { setTab("categories"); setQuery(""); }} className={tab === "categories" ? "active" : ""}>Categories</button><button onClick={() => { setTab("animals"); setQuery(""); }} className={tab === "animals" ? "active" : ""}>Animals</button></nav><div className="animalDataFilters"><label>{tab === "categories" ? "Find a category" : "Find an animal"}<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder={tab === "categories" ? "Weight, teeth, height…" : "Bear, shark, fox…"}/></label>{tab === "categories" && <label>Categories<select value={kind} onChange={event => setKind(event.target.value)}><option value="all">All</option><option value="intuitive">Intuitive</option><option value="specialist">Specialist</option></select></label>}{tab === "animals" && <><label>Animal group<select value={group} onChange={event => { setGroup(event.target.value); setPage(0); }}><option value="all">All groups</option>{groups.map(value => <option key={value} value={value}>{groupNames[value] ?? value.replaceAll("-", " ")}</option>)}</select></label><label>Availability<select value={availability} onChange={event => { setAvailability(event.target.value); setPage(0); }}><option value="all">All catalog animals</option><option value="playable">Appears in rounds</option><option value="catalog">Catalog only</option></select></label></>}</div>
  {tab === "categories" ? <><p className="animalCoverageNote">{prizeNames} prize names. Opposites use the same observations.</p><div className="animalDataTable"><table><thead><tr><th>Category</th><th>Coverage</th><th>Source</th><th>Explore</th></tr></thead><tbody>{traits.filter(t => (kind === "all" || t.categoryKind === kind) && `${t.displayName} ${allTraits.get(t.counterTraitId!)?.displayName} ${t.metricKey}`.toLowerCase().includes(query.toLowerCase())).map(t => <tr key={t.id}><td><strong>{t.displayName}</strong><small>{allTraits.get(t.counterTraitId!)?.displayName}</small><details><summary>Definition</summary><p>{t.definition}</p><p>Comparison: {animalComparisonScope(t).label}</p></details></td><td>{observations.get(t.id)?.length} animals</td><td><a href={sources.get(t.canonicalSourceId)?.url} target="_blank" rel="noreferrer">{sources.get(t.canonicalSourceId)?.name}</a><small>{sources.get(t.canonicalSourceId)?.versionYear}</small></td><td><button onClick={() => setSourceTrait(t)}>Data &amp; Source</button><div className="animalDataPlayButtons">{used.has(t.id) && <button onClick={() => onPlay(t.id)}>Play</button>}{t.counterTraitId && used.has(t.counterTraitId) && <button onClick={() => onPlay(t.counterTraitId!)}>Play opposite</button>}</div></td></tr>)}</tbody></table></div></> : <><p className="animalCoverageNote">{filteredAnimals.length} of {data.animals.length} animals and breeds. Data coverage varies by category.</p><div className="animalDataTable"><table><thead><tr><th>Animal</th><th>Group</th><th>Measurements</th></tr></thead><tbody>{visibleAnimals.map(a => { const values = animalMeasurements.get(a.id) ?? []; return <tr key={a.id}><td><strong>{a.commonName}</strong><small>{a.entityType === "breed" ? `${a.scientificName} · breed` : a.scientificName}</small></td><td>{a.taxonomicGroup.replaceAll("-", " ")}</td><td><details><summary>{values.length} sourced values</summary>{values.map(({t,v}) => <p key={t.id}><button onClick={() => setSourceTrait(t)}>{t.displayName}</button> · {formatAnimalValue(v.valueNumeric, v.unit)}</p>)}</details></td></tr>; })}</tbody></table>{filteredAnimals.length === 0 && <p role="status">No animals match these filters.</p>}</div>{pageCount > 1 && <nav className="animalCatalogPagination" aria-label="Animal catalog pages"><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span aria-live="polite">{currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, filteredAnimals.length)} of {filteredAnimals.length}</span><button disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</button></nav>}</>}
  {sourceTrait && <AnimalSourcePanel data={data} trait={sourceTrait} boardIds={[]} onClose={() => setSourceTrait(null)} />}
  </section>;
}
