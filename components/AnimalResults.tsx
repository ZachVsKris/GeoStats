"use client";

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

export default function AnimalResults({ data, board, results, mode, total, optimalChoices, onNext, onHelp, onScoring }: { data: AnimalDataset; board: BoardCandidate; results: Result[]; mode: DailyDifficulty; total: number; optimalChoices: number; onNext: () => void; onHelp: () => void; onScoring: () => void }) {
  const [openRanking, setOpenRanking] = useState<string | null>(null);
  const [sourceTrait, setSourceTrait] = useState<Trait | null>(null);
  const animals = useMemo(() => new Map(data.animals.map(a => [a.id, a])), [data.animals]);
  const sources = useMemo(() => new Map(data.sources.map(s => [s.id, s])), [data.sources]);
  const catalogRanks = useMemo(() => new Map(results.map(({ trait }) => {
    const values = data.values.filter(v => v.traitId === trait.id && v.confidence === "approved" && v.observationType !== "imputed").sort((a, b) => trait.direction === "higher_wins" ? b.valueNumeric - a.valueNumeric : a.valueNumeric - b.valueNumeric);
    return [trait.id, new Map(values.map(v => [v.animalId, values.findIndex(x => x.valueNumeric === v.valueNumeric) + 1]))];
  })), [data.values, results]);
  const config = ROUND_CONFIGS[mode];
  return <section className="panel results animalGeoResults" aria-label="Results">
    <nav className="resultsModeTabs" aria-label="Results difficulty"><span className="active">{config.label}</span><button onClick={onHelp}>How to play</button><button onClick={onScoring}>Scoring</button></nav>
    <div className="score"><span>Final score</span><div className="scoreValue"><strong>{total}</strong><b>/ {config.maxScore}</b></div><div className="scoreBreakdown" aria-label="Optimal Choices"><span>Optimal Choices: <strong>{optimalChoices} of {board.traitIds.length}</strong></span><span>Optimal score: {config.maxScore}</span></div><div className="scoreActions"><button className="secondaryScoreAction" onClick={onNext}>Generate another board</button></div></div>
    <div className="resultsHeading"><div><span className="kicker">Your placements</span><h3>Placement and points earned</h3></div><small>Open a ranking to compare the {board.animalIds.length} animals on this board</small></div>
    {results.map(({ trait, selected, ranked, rank, points }) => {
      const source = sources.get(selected.value.sourceId)!;
      const best = ranked[0];
      return <div className="resultWrap" key={trait.id}><div className="result"><div className="resultMain"><span aria-hidden="true">★</span><div><strong>{trait.displayName}</strong><small>Your choice: {animals.get(selected.animalId)?.commonName} · {valueLabel(selected.value.valueNumeric, trait.unit)}<span className="resultReference"> · {referenceLabel(source.versionYear)}</span></small></div></div><div className="placementSummary"><b>{ordinal(rank)} of {board.animalIds.length}</b><strong>{points} pts</strong></div><div className="mobileBestMatch"><strong>Optimal Choice</strong><span>{animals.get(best.animalId)?.commonName} · {valueLabel(best.value.valueNumeric, trait.unit)}</span></div><button className="leaderboardButton" aria-expanded={openRanking === trait.id} onClick={() => setOpenRanking(openRanking === trait.id ? null : trait.id)}>{openRanking === trait.id ? "Hide ranking" : "View ranking"}</button></div>
      {openRanking === trait.id && <div className="leaderboard"><div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{trait.displayName}</h4><span>Among these {board.animalIds.length} animals</span></div><div className="leaderboardSource"><span className="sourceBadge">{source.name}</span><button className="sourceDetailsButton" onClick={() => setSourceTrait(trait)}>Data &amp; Source</button></div></div><div className="leaderboardColumns" aria-hidden="true"><b>Board</b><b>Animal</b><b>Catalog Rank</b><b>Value</b><b>Reference</b><b>Points</b></div>{ranked.map((entry, index) => <div key={entry.animalId} className={entry.animalId === selected.animalId ? "current" : ""}><b className="boardRank">#{index + 1}</b><span className="leaderboardCountry">{animals.get(entry.animalId)?.commonName}</span><span className="worldRank">#{catalogRanks.get(trait.id)?.get(entry.animalId)}</span><span className="leaderboardValue"><span className="mobileColumnLabel">Value</span>{valueLabel(entry.value.valueNumeric, trait.unit)}</span><small className="leaderboardReference"><span className="mobileColumnLabel">Reference</span>{referenceLabel(sources.get(entry.value.sourceId)?.versionYear)}</small><strong className="leaderboardPoints">{config.pointsByRank[index]} pts</strong></div>)}</div>}</div>;
    })}
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
    setLoadedValues(null); setLoading(true); setLoadError(false);
    fetch(`/api/animals/data?trait=${encodeURIComponent(trait.id)}`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Ranking unavailable");
      const result = await response.json();
      if (!["warehouse", "release-snapshot"].includes(result.origin) || !Array.isArray(result.values)) throw new Error("Ranking unavailable");
      setLoadedValues(result.values);
    }).catch(() => { if (!controller.signal.aborted) setLoadError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [trait.id]);
  const source = data.sources.find(s => s.id === trait.canonicalSourceId)!;
  const values = (loadedValues ?? data.values).filter(v => v.traitId === trait.id && v.confidence === "approved" && v.observationType !== "imputed").sort((a, b) => trait.direction === "higher_wins" ? b.valueNumeric - a.valueNumeric : a.valueNumeric - b.valueNumeric);
  const rows = values.map(v => ({ ...v, animal: data.animals.find(a => a.id === v.animalId)!, rank: values.findIndex(x => x.valueNumeric === v.valueNumeric) + 1 }));
  function download() {
    const fields = ["rank", "commonName", "scientificName", "value", "displayValue", "unit", "source", "sourceVersion", "sourceUrl", "sex", "lifeStage", "measurementBasis", "observationType", "valueMin", "valueMax", "notes"];
    const csv = [fields, ...rows.map(row => [row.rank, row.animal.commonName, row.animal.scientificName, row.valueNumeric, valueLabel(row.valueNumeric, row.unit), row.unit, source.name, source.versionYear, source.url, row.sex, row.lifeStage, row.measurementBasis, row.observationType, row.valueMin ?? "", row.valueMax ?? "", row.notes])].map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `animalstats-${trait.id}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="sourceModal" role="dialog" aria-modal="true" aria-label={`${trait.displayName} data and source`} onMouseDown={event => event.target === event.currentTarget && onClose()}><div ref={panelRef} className="sourcePanel sourcePanelSimple"><button className="sourceClose" onClick={onClose} aria-label="Close data and source">×</button><header className="sourceHero"><div className="sourceHeroTop"><span className="sourceHeroIcon">★</span><div className="sourceHeroCopy"><h2>{trait.displayName}</h2><p className="sourceHeroDescription">{trait.definition}</p></div></div><div className="sourceSpec"><span className="sourceSpecPrimary">{source.name}</span><span>{source.versionYear}</span><span>{trait.unit}</span></div></header><div className="sourceTableHeader"><div><h3>Full catalog rankings</h3><span>{rows.length} animals · this board highlighted</span></div><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Look up an animal" aria-label="Look up an animal" /></div><>{loading && <p className="sourceLoading">Loading the complete ranking…</p>}{loadError && <p className="sourceLoadError">Source details are unavailable. Showing the saved ranking.</p>}</><p className="animalCoverageNote">These ranks cover animals with eligible measurements in our catalog, not every species on Earth. Equal values share a rank. Missing measurements are excluded.</p><div className="sourceDataTable" role="table" aria-label={`${trait.displayName} full catalog rankings`}><div className="sourceDataHead" role="row"><b>Rank</b><b>Animal</b><b>Value</b><b>Reference</b></div>{rows.filter(row => `${row.animal.commonName} ${row.animal.scientificName}`.toLowerCase().includes(query.toLowerCase())).map(row => <div role="row" className={`sourceDataRow ${boardIds.includes(row.animalId) ? "boardCountry" : ""}`} key={row.animalId}><b>#{row.rank}</b><span>{row.animal.commonName}<small>{row.animal.scientificName}</small></span><span title={String(row.valueNumeric)}>{valueLabel(row.valueNumeric, trait.unit)}</span><small>{source.versionYear}<details><summary>Observation</summary><p>{row.sex} · {row.lifeStage}</p><p>{row.measurementBasis}</p><p>{row.notes}</p></details></small></div>)}</div><div className="sourceTableHeader"><a href={source.url} target="_blank" rel="noreferrer">Original source ↗</a><button onClick={download} disabled={loading || loadError}>Download full data (CSV)</button></div><p className="animalCoverageNote">Source license: {source.license}. Uncertainty intervals are shown only when supplied by the source; blank bounds do not mean zero uncertainty.</p></div></div>;
}
