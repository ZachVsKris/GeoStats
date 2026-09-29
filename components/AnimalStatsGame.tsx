"use client";

import { useMemo, useState } from "react";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import type { AnimalDataset, BoardCandidate, ReviewLabel } from "../lib/animalstats";
import "../app/animals/animalstats.css";

type Props = { data: AnimalDataset; boards: BoardCandidate[] };
type Assignment = Record<string, string>;

function formatValue(value: number, unit: string) {
  const shown = new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 10 ? 2 : 1 }).format(value);
  return `${shown} ${unit}`;
}

export default function AnimalStatsGame({ data, boards }: Props) {
  const [mode, setMode] = useState<DailyDifficulty>("easy");
  const [boardIndex, setBoardIndex] = useState(0);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [reviewLabel, setReviewLabel] = useState<ReviewLabel | "">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);
  const pool = boards.filter((board) => board.mode === mode);
  const board = pool[boardIndex % pool.length];
  const animalMap = useMemo(() => new Map(data.animals.map((animal) => [animal.id, animal])), [data.animals]);
  const photoMap = useMemo(() => new Map(data.photos.map((photo) => [photo.animalId, photo])), [data.photos]);
  const traitMap = useMemo(() => new Map(data.traits.map((trait) => [trait.id, trait])), [data.traits]);
  const valueMap = useMemo(() => new Map(data.values.map((row) => [`${row.animalId}:${row.traitId}`, row])), [data.values]);
  const sourceMap = useMemo(() => new Map(data.sources.map((source) => [source.id, source])), [data.sources]);
  const config = ROUND_CONFIGS[mode];

  function switchBoard(nextMode: DailyDifficulty, index = 0) {
    setMode(nextMode);
    setBoardIndex(index);
    setAssignments({});
    setSelectedTrait(null);
    setSubmitted(false);
    setMessage("");
    setCopied(false);
    setReviewLabel("");
    setReviewNotes("");
    setReviewSaved(false);
  }

  function assign(traitId: string, animalId: string) {
    if (submitted) return;
    setAssignments((previous) => {
      const next = { ...previous };
      const previousTrait = Object.keys(next).find((id) => next[id] === animalId);
      if (previousTrait) delete next[previousTrait];
      if (next[traitId] === animalId) delete next[traitId];
      else next[traitId] = animalId;
      return next;
    });
    setSelectedTrait(null);
    setMessage("");
  }

  const results = board?.traitIds.map((id) => {
    const trait = traitMap.get(id)!;
    const ranked = board.animalIds.map((animalId) => ({ animalId, value: valueMap.get(`${animalId}:${id}`)! }))
      .sort((a, b) => trait.direction === "higher_wins"
        ? b.value.valueNumeric - a.value.valueNumeric : a.value.valueNumeric - b.value.valueNumeric);
    const assigned = assignments[id];
    const rank = ranked.findIndex((row) => row.animalId === assigned) + 1;
    return { trait, ranked, selected: ranked[rank - 1], rank,
      points: rank ? config.pointsByRank[rank - 1] : 0 };
  }) ?? [];
  const total = results.reduce((sum, row) => sum + row.points, 0);
  const optimalChoices = results.filter((row) => row.rank === 1).length;

  if (!board) return <main className="animalPage"><p>No pilot boards are available for this mode yet.</p></main>;

  return <main className="animalPage">
    <div className="animalShell">
      <header className="animalHeader">
        <a href="/daily" className="animalBack">← GeoStats</a>
        <div className="animalEyebrow">FIELD NOTES · PRIVATE PLAYTEST</div>
        <h1>AnimalStats</h1>
        <p>Match each animal to the trait where it ranks strongest. Use every animal at most once.</p>
      </header>
      <nav className="animalModes" aria-label="Difficulty">
        {(["easy", "normal", "expert"] as const).map((difficulty) => <button key={difficulty} type="button"
          aria-current={mode === difficulty ? "page" : undefined} onClick={() => switchBoard(difficulty)}>
          {ROUND_CONFIGS[difficulty].label}<small>{ROUND_CONFIGS[difficulty].countryCount} animals · {ROUND_CONFIGS[difficulty].categoryCount} traits</small>
        </button>)}
      </nav>
      <div className="animalBoardTop">
        <div><span className="animalEyebrow">BOARD {boardIndex + 1} OF {pool.length} · {board.boardType.toUpperCase()}</span>
          <h2>{submitted ? "Your field report" : "Make your matches"}</h2></div>
        <button type="button" className="animalNext" onClick={() => switchBoard(mode, (boardIndex + 1) % pool.length)}>Another board →</button>
      </div>
      <p className="animalPilotNote">Pilot board awaiting human review. Values are sourced; rankings may still need an uncertainty and playability check.</p>
      {!submitted && <>
        <p className="animalInstruction">Select a trait, then choose an animal. Tap an assigned animal to move it.</p>
        <section className="animalTraits" aria-label="Traits">
          {board.traitIds.map((id) => {
            const trait = traitMap.get(id)!;
            const animal = animalMap.get(assignments[id]);
            return <button type="button" key={id} className={`animalTrait ${selectedTrait === id ? "selected" : ""}`}
              aria-pressed={selectedTrait === id} onClick={() => setSelectedTrait(id)}>
              <span className="animalTraitName">{trait.displayName}</span>
              <span className="animalTraitDefinition">{trait.definition}</span>
              <span className="animalTraitChoice">{animal ? animal.commonName : "Choose an animal +"}</span>
            </button>;
          })}
        </section>
        <section className="animalBank" aria-label="Available animals">
          {board.animalIds.map((id) => {
            const animal = animalMap.get(id)!;
            const photo = photoMap.get(id)!;
            const usedOn = Object.keys(assignments).find((key) => assignments[key] === id);
            return <button type="button" key={id} className={`animalCard ${usedOn ? "used" : ""}`}
              onClick={() => selectedTrait ? assign(selectedTrait, id) : setMessage("Select a trait above, then choose an animal.")}>
              <img src={photo.assetUrl} alt="" />
              <span>{animal.commonName}</span><small>{animal.scientificName}</small>
              {usedOn && <em>Assigned to {traitMap.get(usedOn)?.displayName}</em>}
            </button>;
          })}
        </section>
        <div className="animalSubmit"><button type="button" onClick={() => {
          if (Object.keys(assignments).length < board.traitIds.length) {
            setMessage(`Choose an animal for all ${board.traitIds.length} traits first.`); return;
          }
          setSubmitted(true);
          setMessage("");
        }}>Reveal results</button>{message && <p role="status">{message}</p>}</div>
      </>}
      {submitted && <>
        <section className="animalScore" aria-label="Results"><div><span className="animalEyebrow">FINAL SCORE</span>
          <strong>{total}<small> / {config.maxScore}</small></strong></div>
          <div><span className="animalEyebrow">OPTIMAL CHOICES</span><strong>{optimalChoices}<small> / {board.traitIds.length}</small></strong></div>
          <div><span className="animalEyebrow">OPTIMAL SCORE</span><strong>{config.maxScore}</strong></div></section>
        <section className="animalResults" aria-label="Trait results">
          {results.map(({ trait, ranked, selected, rank, points }) => {
            const best = ranked[0];
            const photo = photoMap.get(selected.animalId)!;
            const source = sourceMap.get(selected.value.sourceId)!;
            return <article key={trait.id} className="animalResult">
              <img src={photo.assetUrl} alt="" />
              <div className="animalResultBody"><h3>{trait.displayName}</h3>
                <p>Your choice: <strong>{animalMap.get(selected.animalId)?.commonName}</strong> · {formatValue(selected.value.valueNumeric, trait.unit)}</p>
                <p>Rank {rank} of {board.animalIds.length} · <strong>{points} points</strong></p>
                <p>Optimal choice: <strong>{animalMap.get(best.animalId)?.commonName}</strong> · {formatValue(best.value.valueNumeric, trait.unit)}</p>
                <details><summary>Definition and source</summary><p>{trait.definition}. {source.name}, {source.versionYear}. <a href={source.url} target="_blank" rel="noreferrer">View dataset</a>.</p></details>
              </div>
            </article>;
          })}
        </section>
        <div className="animalActions"><button type="button" onClick={() => switchBoard(mode, (boardIndex + 1) % pool.length)}>Try another board</button>
          <button type="button" className="animalNext" onClick={async () => {
            const message = `AnimalStats ${config.label}: ${total}/${config.maxScore} · ${optimalChoices} Optimal Choices`;
            try { await navigator.clipboard.writeText(message); setCopied(true); } catch { setCopied(false); }
          }}>{copied ? "Copied ✓" : "Copy result"}</button></div>
        <section className="animalReview" aria-label="Playtest feedback">
          <h3>Playtest note</h3><p>Did the board feel fair, surprising, and worth replaying?</p>
          <label>Review label <select value={reviewLabel} onChange={(event) => { setReviewLabel(event.target.value as ReviewLabel | ""); setReviewSaved(false); }}>
            <option value="">Choose a label</option>
            {(["PASS", "TOO_OBVIOUS", "UNKNOWABLE", "BAD_METRIC", "DATA_CONCERN", "FAMILIARITY_FAIL"] as const)
              .map((label) => <option key={label} value={label}>{label.replaceAll("_", " ")}</option>)}
          </select></label>
          <label>What worked or felt wrong? <textarea value={reviewNotes} onChange={(event) => { setReviewNotes(event.target.value); setReviewSaved(false); }} rows={3} /></label>
          <button type="button" disabled={!reviewLabel} onClick={() => {
            const key = "animalstats:pilot-reviews";
            try {
              const prior = JSON.parse(window.localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
              const boardKey = `${mode}:${board.animalIds.join(",")}:${board.traitIds.join(",")}`;
              prior[boardKey] = { mode, boardType: board.boardType, animalIds: board.animalIds,
                traitIds: board.traitIds, label: reviewLabel, notes: reviewNotes.trim(), savedAt: new Date().toISOString() };
              window.localStorage.setItem(key, JSON.stringify(prior));
              setReviewSaved(true);
            } catch { setMessage("This browser could not save your playtest note."); }
          }}>Save playtest note</button>{reviewSaved && <span role="status">Saved on this browser</span>}
          <button type="button" className="animalExport" onClick={() => {
            const reviews = window.localStorage.getItem("animalstats:pilot-reviews") ?? "{}";
            const url = URL.createObjectURL(new Blob([reviews], { type: "application/json" }));
            const link = document.createElement("a");
            link.href = url; link.download = "animalstats-playtest-reviews.json"; link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>Download all notes</button>{message && <p role="status">{message}</p>}
        </section>
      </>}
      <footer className="animalFooter"><p>Data: <a href="https://genomics.senescence.info/species/" target="_blank" rel="noreferrer">AnAge / HAGR</a> and <a href="https://doi.org/10.6084/m9.figshare.16586228.v7" target="_blank" rel="noreferrer">AVONET</a>. Photos: Wikimedia Commons; individual credits below.</p>
        <details><summary>Photo credits</summary><ul>{board.animalIds.map((id) => { const photo = photoMap.get(id)!; return <li key={id}><a href={photo.originalUrl} target="_blank" rel="noreferrer">{animalMap.get(id)?.commonName}</a>: {photo.attribution}</li>; })}</ul></details>
        <p>Private experimental prototype. Scores stay on this page and are not added to GeoStats history.</p></footer>
    </div>
  </main>;
}
