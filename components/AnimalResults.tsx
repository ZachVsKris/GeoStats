"use client";
import { animalComparisonScope } from "../lib/animalstatsCoverage";

import MatchScoreSummary from "./MatchScoreSummary";
import MatchOptimalChoices from "./MatchOptimalChoices";
import type { ReactNode } from "react";
import MatchRanking from "./MatchRanking";
import MatchResultRow from "./MatchResultRow";
import AnimalPortrait from "./AnimalPortrait";
import { animalTraitIcon } from "../lib/animalstatsIcons";
import AnimalCategoryLabel from "./AnimalCategoryLabel";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatAnimalValue } from "../lib/animalstatsFormatting";
import useGameDialog from "./useGameDialog";
import type { AnimalDataset, AnimalTraitValue, BoardCandidate, Trait } from "../lib/animalstats";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";

type Entry = { animalId: string; value: AnimalTraitValue };
type Result = { trait: Trait; ranked: Entry[]; selected: Entry; rank: number; points: number };
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th")}`;
const valueLabel = formatAnimalValue;
const referenceLabel = (version?: string) => version?.match(/\b(?:19|20)\d{2}\b/g)?.at(-1) ?? "Source";

export default function AnimalResults({ data, board, results, mode, total, optimalChoices, presentation, onModeChange, onNext, shareActions }: { data: AnimalDataset; board: BoardCandidate; results: Result[]; mode: DailyDifficulty; total: number; optimalChoices: number; presentation: "cute" | "real"; onModeChange: (mode: DailyDifficulty) => void; onNext: () => void; shareActions: ReactNode }) {
  const orderedResults = useMemo(() => [...results].sort((a, b) => b.points - a.points), [results]);
  const [openRanking, setOpenRanking] = useState<string | null>(null);
  const [sourceTrait, setSourceTrait] = useState<Trait | null>(null);
  const animals = useMemo(() => new Map(data.animals.map(a => [a.id, a])), [data.animals]);
  const sources = useMemo(() => new Map(data.sources.map(s => [s.id, s])), [data.sources]);
  const catalogRanks = useMemo(() => new Map(results.map(({ trait }) => {
    const values = data.values.filter(v => v.traitId === trait.id && v.confidence === "approved" && v.observationType !== "imputed").sort((a, b) => trait.direction === "higher_wins" ? b.valueNumeric - a.valueNumeric : a.valueNumeric - b.valueNumeric);
    return [trait.id, new Map(values.map(v => [v.animalId, values.findIndex(x => x.valueNumeric === v.valueNumeric) + 1]))];
  })), [data.values, results]);
  const config = ROUND_CONFIGS[mode];
  return <section className="panel results" aria-label="Results">
    <nav className="resultsModeTabs" aria-label="Results difficulty">{(["easy", "normal", "expert"] as const).map(difficulty => <a href={`/animals?mode=${difficulty}`} key={difficulty} className={mode === difficulty ? "active" : ""} onClick={event => { event.preventDefault(); onModeChange(difficulty); }}>{ROUND_CONFIGS[difficulty].label}</a>)}</nav>
    <MatchScoreSummary total={total} maximum={config.maxScore} optimal={optimalChoices} categories={board.traitIds.length} rules={<>Each match earns up to 100 points based on its rank among these {board.animalIds.length} animals. An animal ranked first earns 100 points. Lower ranks earn fewer; the score adds up all {board.traitIds.length} matches.</>} pointRules={<>On this board: {config.pointsByRank.map((points,index)=>`${ordinal(index+1)} = ${points}`).join(" · ")} points.</>} actions={<>{shareActions}<button className="secondaryScoreAction" onClick={onNext}>Generate another board</button></>} />
    <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>Placement and points earned</h3></div><small>Open a ranking to compare the {board.animalIds.length} animals on this board</small></div>
    {orderedResults.map(({ trait, selected, ranked, rank, points }) => {
      const source = sources.get(selected.value.sourceId)!;
      const best = ranked[0];
      return <div className="resultWrap" key={trait.id}><MatchResultRow icon={animalTraitIcon(trait)} category={<AnimalCategoryLabel trait={trait} />} choice={<><AnimalPortrait animal={animals.get(selected.animalId)!} photo={data.photos.find(photo => photo.animalId === selected.animalId)} presentation={presentation} /> {animals.get(selected.animalId)?.commonName} · {valueLabel(selected.value.valueNumeric, trait.unit)}<span className="resultReference"> · {referenceLabel(source.versionYear)}</span></>} choiceDetails={<><strong>Why this rank?</strong><br/>Rank #{catalogRanks.get(trait.id)?.get(selected.animalId)} among eligible animals in our catalog.<br/>Actual value: {valueLabel(selected.value.valueNumeric, trait.unit)}<br/>Reference: {referenceLabel(source.versionYear)}<br/>Source: {source.name}<br/><button className="inlineSourceButton" onClick={event => { event.stopPropagation(); setSourceTrait(trait); }}>Data &amp; Source</button></>} placement={`${ordinal(rank)} of ${board.animalIds.length}`} points={points} best={<><AnimalPortrait animal={animals.get(best.animalId)!} photo={data.photos.find(photo => photo.animalId === best.animalId)} presentation={presentation} /> {animals.get(best.animalId)?.commonName} · {valueLabel(best.value.valueNumeric, trait.unit)}</>} open={openRanking === trait.id} onToggle={() => setOpenRanking(openRanking === trait.id ? null : trait.id)} />
      {openRanking === trait.id && <MatchRanking title={<AnimalCategoryLabel trait={trait}/>} count={board.animalIds.length} plural="animals" entityLabel="Animal" rankLabel="Catalog Rank" source={source.name} onSource={()=>setSourceTrait(trait)} rows={ranked.map((entry,index)=>({id:entry.animalId,boardRank:index+1,name:<><AnimalPortrait animal={animals.get(entry.animalId)!} photo={data.photos.find(photo=>photo.animalId===entry.animalId)} presentation={presentation}/> {animals.get(entry.animalId)?.commonName}</>,catalogRank:catalogRanks.get(trait.id)?.get(entry.animalId),value:valueLabel(entry.value.valueNumeric,trait.unit),reference:referenceLabel(sources.get(entry.value.sourceId)?.versionYear),points:config.pointsByRank[index],selected:entry.animalId===selected.animalId}))} />}</div>;
    })}
    <MatchOptimalChoices description={<>Each category’s best animal among these {board.animalIds.length}</>} rows={results.map(({trait,ranked})=>{const best=ranked[0],source=sources.get(best.value.sourceId)!;return {id:trait.id,icon:animalTraitIcon(trait),category:<AnimalCategoryLabel trait={trait}/>,measurement:trait.measurementBasis,best:<><AnimalPortrait animal={animals.get(best.animalId)!} photo={data.photos.find(photo=>photo.animalId===best.animalId)} presentation={presentation}/> {animals.get(best.animalId)?.commonName} · {valueLabel(best.value.valueNumeric,trait.unit)}<span className="resultReference"> · {referenceLabel(source.versionYear)}</span></>,details:<><strong>Why this rank?</strong><br/>Rank #{catalogRanks.get(trait.id)?.get(best.animalId)} among eligible animals in our catalog.<br/>Actual value: {valueLabel(best.value.valueNumeric,trait.unit)}<br/>Reference: {referenceLabel(source.versionYear)}<br/>Source: {source.name}<br/><button className="inlineSourceButton" onClick={event=>{event.stopPropagation();setSourceTrait(trait);}}>Data &amp; Source</button></>};})} />
    <div className="lock resultsFooter"><span>Maximum score: {config.maxScore}</span></div>
    {sourceTrait && <AnimalSourcePanel data={data} trait={sourceTrait} boardIds={board.animalIds} onClose={() => setSourceTrait(null)} />}
  </section>;
}

export function AnimalSourcePanel({ data, trait, boardIds, onClose }: { data: AnimalDataset; trait: Trait; boardIds: string[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  useGameDialog(true, panelRef, onClose);
  const [loadedValues, setLoadedValues] = useState<AnimalTraitValue[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); setLoadError(true); setLoading(false); }, 12000);
    setLoadedValues(null); setLoading(true); setLoadError(false);
    fetch(`/api/animals/data?trait=${encodeURIComponent(trait.id)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Ranking unavailable");
      const result = await response.json();
      if (!["warehouse", "release-snapshot"].includes(result.origin) || !Array.isArray(result.values)) throw new Error("Ranking unavailable");
      setLoadedValues(result.values);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); }).finally(() => { clearTimeout(timeout); if (!controller.signal.aborted) setLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [trait.id]);
  const source = data.sources.find(s => s.id === trait.canonicalSourceId)!;
  const values = (loadedValues ?? data.values).filter(v => v.traitId === trait.id && v.confidence === "approved" && v.observationType !== "imputed").sort((a, b) => trait.direction === "higher_wins" ? b.valueNumeric - a.valueNumeric : a.valueNumeric - b.valueNumeric);
  const rows = values.map(v => ({ ...v, animal: data.animals.find(a => a.id === v.animalId)!, rank: values.findIndex(x => x.valueNumeric === v.valueNumeric) + 1 }));
  function download() {
    const fields = ["rank", "commonName", "scientificName", "value", "displayValue", "unit", "source", "sourceVersion", "sourceUrl", "sex", "lifeStage", "measurementBasis", "observationType", "valueMin", "valueMax", "notes"];
    const csv = [fields, ...rows.map(row => [row.rank, row.animal.commonName, row.animal.scientificName, row.valueNumeric, valueLabel(row.valueNumeric, row.unit), row.unit, source.name, source.versionYear, source.url, row.sex, row.lifeStage, row.measurementBasis, row.observationType, row.valueMin ?? "", row.valueMax ?? "", row.notes])].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `animalstats-${trait.id}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="sourceModal" role="dialog" aria-modal="true" aria-label={`${trait.displayName} data and source`} onMouseDown={event => event.target === event.currentTarget && onClose()}><div ref={panelRef} className="sourcePanel sourcePanelSimple"><button className="sourceClose" onClick={onClose} aria-label="Close data and source">×</button><header className="sourceHero"><div className="sourceHeroTop"><span className="sourceHeroIcon">{animalTraitIcon(trait)}</span><div className="sourceHeroCopy"><h2>{trait.displayName}</h2><p className="sourceHeroDescription">{trait.definition}</p><p>Comparison: {animalComparisonScope(trait).label}</p></div></div><div className="sourceSpec"><span className="sourceSpecPrimary">{source.name}</span><span>{source.versionYear}</span><span>{trait.unit}</span></div></header><div className="sourceTableHeader"><div><h3>Full catalog rankings</h3><span>{rows.length} animals · this board highlighted</span></div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Look up an animal" aria-label="Look up an animal" /></div><>{loading && <p className="sourceLoading">Loading the complete ranking…</p>}{loadError && <p className="sourceLoadError">Source details are unavailable. Showing the saved ranking.</p>}</><p className="animalCoverageNote">These ranks cover animals with eligible measurements in our catalog, not every species on Earth. Equal values share a rank. Missing measurements are excluded.</p><div className="sourceDataTable" role="table" aria-label={`${trait.displayName} full catalog rankings`}><div className="sourceDataHead" role="row"><b>Rank</b><b>Animal</b><b>Value</b><b>Reference</b></div>{rows.filter(row => `${row.animal.commonName} ${row.animal.scientificName}`.toLowerCase().includes(query.toLowerCase())).map(row => <div role="row" className={`sourceDataRow ${boardIds.includes(row.animalId) ? "boardCountry" : ""}`} key={row.animalId}><b>#{row.rank}</b><span>{row.animal.commonName}<small>{row.animal.scientificName}</small></span><span title={String(row.valueNumeric)}>{valueLabel(row.valueNumeric, trait.unit)}</span><small>{source.versionYear}<details><summary>Observation</summary><p>{row.sex} · {row.lifeStage}</p><p>{row.measurementBasis}</p><p>{row.notes}</p></details></small></div>)}</div><div className="sourceTableHeader"><a href={source.url} target="_blank" rel="noreferrer">Original source ↗</a><button onClick={download} disabled={loading}>{loadError ? "Download saved data (CSV)" : "Download full data (CSV)"}</button></div><p className="animalCoverageNote">Source license: {source.license}. Uncertainty intervals are shown only when supplied by the source; blank bounds do not mean zero uncertainty.</p></div></div>;
}
