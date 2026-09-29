"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ROUND_CONFIGS, type DailyDifficulty } from "../lib/gameRules";
import type { AnimalDataset, BoardCandidate, ReviewLabel } from "../lib/animalstats";
import { ANIMAL_HISTORY_KEY, animalStats, readAnimalHistory, type AnimalGameResult } from "../lib/animalstatsHistory";
import "../app/animals/animalstats.css";

type Props = { data: AnimalDataset; boards: BoardCandidate[]; approvedBoardIds: string[]; date: string };
type Assignment = Record<string, string>;

function formatValue(value: number, unit: string) {
  const shown = new Intl.NumberFormat("en-US", { maximumFractionDigits: value < 10 ? 2 : 1 }).format(value);
  return `${shown} ${unit}`;
}

export default function AnimalStatsGame({ data, boards, approvedBoardIds, date }: Props) {
  const [view, setView] = useState<"play" | "stats" | "guide">("play");
  const [guideSearch, setGuideSearch] = useState("");
  const [guideGroup, setGuideGroup] = useState("all");
  const [playKind, setPlayKind] = useState<"daily" | "random">("random");
  const [signedIn, setSignedIn] = useState(false);
  const [accountMessage, setAccountMessage] = useState("");
  const [history, setHistory] = useState<AnimalGameResult[]>([]);
  useEffect(() => {
    try { setHistory(readAnimalHistory(localStorage.getItem(ANIMAL_HISTORY_KEY))); } catch { /* Play remains available without browser storage. */ }
    const controller = new AbortController();
    fetch("/api/animals/results", { signal: controller.signal }).then((response) => response.json()).then((payload) => {
      setSignedIn(payload.signedIn === true);
      if (payload.signedIn && Array.isArray(payload.results)) setHistory(readAnimalHistory(JSON.stringify(payload.results)));
    }).catch(() => { /* Device history remains usable when account loading is unavailable. */ });
    return () => controller.abort();
  }, []);
  const [mode, setMode] = useState<DailyDifficulty>("easy");
  const [boardIndex, setBoardIndex] = useState(0);
  useEffect(() => { setBoardIndex(Math.floor(Math.random() * Math.max(1, boards.filter((board) => board.mode === "easy").length))); }, [boards]);
  const [assignments, setAssignments] = useState<Assignment>({});
  const [selectedTrait, setSelectedTrait] = useState<string | null>(null);
  const [selectedAnimal, setSelectedAnimal] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const pointer = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [reviewLabel, setReviewLabel] = useState<ReviewLabel | "">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSaved, setReviewSaved] = useState(false);
  const modeBoards = boards.filter((board) => board.mode === mode);
  const pool = playKind === "daily" ? modeBoards.filter((board) => approvedBoardIds.includes(board.id ?? "")).slice(0, 3) : modeBoards;
  const board = pool[boardIndex % pool.length];
  const animalMap = useMemo(() => new Map(data.animals.map((animal) => [animal.id, animal])), [data.animals]);
  const photoMap = useMemo(() => new Map(data.photos.map((photo) => [photo.animalId, photo])), [data.photos]);
  const traitMap = useMemo(() => new Map(data.traits.map((trait) => [trait.id, trait])), [data.traits]);
  const valueMap = useMemo(() => new Map(data.values.map((row) => [`${row.animalId}:${row.traitId}`, row])), [data.values]);
  const sourceMap = useMemo(() => new Map(data.sources.map((source) => [source.id, source])), [data.sources]);
  const config = ROUND_CONFIGS[mode];
  const stats = animalStats(history, mode);

  function switchBoard(nextMode: DailyDifficulty, index = 0) {
    setMode(nextMode);
    setBoardIndex(index);
    setAssignments({});
    setSelectedTrait(null);
    setSelectedAnimal(null);
    setSubmitted(false);
    setMessage("");
    setCopied(false);
    setReviewLabel("");
    setReviewNotes("");
    setReviewSaved(false);
    setAccountMessage("");
  }

  function nextBoard() {
    const next = playKind === "daily" ? (boardIndex + 1) % pool.length : (boardIndex + 1 + Math.floor(Math.random() * Math.max(1, pool.length - 1))) % pool.length;
    switchBoard(mode, next);
  }

  function saveResult() {
    if (!board) return;
    const boardId = board.id ?? `${mode}:${board.animalIds.join(",")}:${board.traitIds.join(",")}`;
    const id = `${playKind}:${date}:${boardId}`;
    const entry: AnimalGameResult = { id, boardId, date, mode, kind: playKind, score: total, optimalChoices,
      averagePlacement: results.reduce((sum, row) => sum + row.rank, 0) / results.length,
      ranks: results.map((row) => row.rank), completedAt: new Date().toISOString() };
    try {
      const current = readAnimalHistory(localStorage.getItem(ANIMAL_HISTORY_KEY));
      // First completion per board/day counts; replaying cannot inflate the rating.
      const next = current.some((row) => row.id === id) ? current : [entry, ...current];
      localStorage.setItem(ANIMAL_HISTORY_KEY, JSON.stringify(next));
      if (signedIn) setHistory((previous) => previous.some((row) => row.id === id) ? previous : [entry, ...previous]);
      else setHistory(next);
      setAccountMessage("Saved on this device");
    } catch { setMessage("Your results could not be saved in this browser."); }
    if (signedIn) {
      fetch("/api/animals/results", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ boardId, kind: playKind, assignments }) }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw Error(payload.error ?? "Account saving is unavailable.");
        const saved = readAnimalHistory(JSON.stringify([payload.result]))[0];
        if (!saved) throw Error("Saved result could not be verified.");
        setHistory((previous) => [saved, ...previous.filter((row) => row.id !== saved.id)]);
        setAccountMessage("Saved to your account");
      }).catch(() => setAccountMessage("Account saving is unavailable; your device result is retained."));
    }
  }

  function assign(traitId: string, animalId: string) {
    if (submitted) return;
    setAssignments((previous) => {
      const next = { ...previous };
      const previousTrait = Object.keys(next).find((id) => next[id] === animalId);
      const displaced = next[traitId];
      if (previousTrait === traitId) delete next[traitId];
      else {
        if (previousTrait) {
          if (displaced) next[previousTrait] = displaced;
          else delete next[previousTrait];
        }
        next[traitId] = animalId;
      }
      return next;
    });
    setSelectedTrait(null);
    setSelectedAnimal(null);
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


  return <main className="animalPage">
    <div className="animalShell">
      <header className="animalHeader">
        <a href="/cat" className="animalBack">← Countries, Animals & Things</a>
        <div className="animalEyebrow">THE LIVING WORLD · PRIVATE PLAYTEST</div>
        <h1>AnimalStats</h1>
        <p>Match each animal to the trait where it ranks strongest. Use every animal at most once.</p>
      </header>
      <nav className="catWorldNav" aria-label="Worlds"><a href="/daily">Countries</a><a href="/animals" aria-current="page">Animals</a><a href="/cat#things">Things</a></nav>
      <nav className="animalPlayNav" aria-label="AnimalStats play">
        <button type="button" aria-pressed={view === "play" && playKind === "daily"} onClick={() => { setPlayKind("daily"); setView("play"); switchBoard(mode); }}>Daily</button>
        <button type="button" aria-pressed={view === "play" && playKind === "random"} onClick={() => { setPlayKind("random"); setView("play"); switchBoard(mode); }}>Random</button>
        <button type="button" aria-pressed={view === "guide"} onClick={() => setView("guide")}>Field Guide</button>
        <button type="button" aria-pressed={view === "stats"} onClick={() => setView("stats")}>My Stats</button>
      </nav>
      <nav className="animalModes" aria-label="Difficulty">
        {(["easy", "normal", "expert"] as const).map((difficulty) => <button key={difficulty} type="button"
          aria-current={mode === difficulty ? "page" : undefined} onClick={() => switchBoard(difficulty)}>
          {ROUND_CONFIGS[difficulty].label}<small>{ROUND_CONFIGS[difficulty].countryCount} animals · {ROUND_CONFIGS[difficulty].categoryCount} traits</small>
        </button>)}
      </nav>
      {view === "guide" ? <section className="animalGuide" aria-label="Animal field guide">
        <h2>The collection</h2><p>{data.animals.length} animals · {data.traits.length} traits · {data.values.length} sourced measurements. Data coverage varies; an animal enters a board only when every required comparison and photo passes validation.</p>
        <div className="animalGuideFilters"><label>Find an animal<input type="search" value={guideSearch} onChange={(event) => setGuideSearch(event.target.value)} placeholder="Frog, shark, bear…" /></label><label>Animal group<select value={guideGroup} onChange={(event) => setGuideGroup(event.target.value)}><option value="all">All groups</option>{[...new Set(data.animals.map((animal) => animal.taxonomicGroup))].sort().map((group) => <option key={group} value={group}>{group.replaceAll("-", " ")}</option>)}</select></label></div>
        <div className="animalGuideGrid">{data.animals.filter((animal) => (guideGroup === "all" || animal.taxonomicGroup === guideGroup) && `${animal.commonName} ${animal.scientificName}`.toLowerCase().includes(guideSearch.toLowerCase())).map((animal) => {
          const photo = photoMap.get(animal.id); const observations = data.values.filter((value) => value.animalId === animal.id);
          return <article key={animal.id} className="animalGuideCard"><div className="animalGuideName">{photo?.approved ? <img src={photo.assetUrl} alt="" /> : <span className="animalGuidePlaceholder" aria-hidden="true">?</span>}<div><h3>{animal.commonName}</h3><em>{animal.scientificName}</em><small>{animal.taxonomicGroup.replaceAll("-", " ")} · {observations.length} measurements</small></div></div>
            <details><summary>Measurements and sources</summary>{observations.length ? observations.map((value) => { const trait = traitMap.get(value.traitId)!; const source = sourceMap.get(value.sourceId)!; return <div key={value.traitId} className="animalGuideMeasurement"><strong>{trait.displayName}: {formatValue(value.valueNumeric, value.unit)}</strong><p>{trait.definition}</p><p><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> · {source.versionYear}</p><p>{value.notes}</p></div>; }) : <p>No eligible measurements in the pinned sources yet.</p>}</details></article>;
        })}</div>
      </section> : view === "stats" ? <section className="animalHistory" aria-label="AnimalStats personal stats">
        <h2>Your {config.label} field notes</h2><p>{signedIn ? "AnimalStats account results. Countries scores are tracked separately." : "AnimalStats results saved on this device. Countries scores are tracked separately."} Your first completion of each board per day counts.</p>
        <div className="animalStatGrid">{[["Average Score", stats.games ? stats.averageScore.toFixed(1) : "—"], ["Best Result", stats.games ? stats.best : "—"], ["Games Played", stats.games], ["Average Placement", stats.games ? stats.averagePlacement.toFixed(2) : "—"], ["Player Rating", stats.rating === null ? "—" : stats.rating.toFixed(1)]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
        {stats.rating === null && <p>Player Rating begins after 5 completed games in this mode.</p>}
        {!signedIn && <p><a href="/account">Sign in</a> to save future AnimalStats results to your account.</p>}
        <h3>Game history</h3>{history.filter((row) => row.mode === mode).length ? <div className="animalHistoryTable"><table><thead><tr><th>Date</th><th>Play</th><th>Score</th><th>Optimal Choices</th></tr></thead><tbody>{history.filter((row) => row.mode === mode).map((row) => <tr key={row.id}><td>{row.date}</td><td>{row.kind}</td><td>{row.score} / {config.maxScore}</td><td>{row.optimalChoices} / {config.categoryCount}</td></tr>)}</tbody></table></div> : <p>Complete a board to start your history.</p>}
        <button className="animalNext" type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(history, null, 2)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = "animalstats-history.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Download history</button>
        <button className="animalNext" type="button" onClick={() => setView("play")}>Back to game</button>
      </section> : !board ? <section className="animalEmpty"><h2>Daily boards are awaiting review</h2><p>A daily board must pass source, uncertainty, and playability review. Numerical validation alone does not approve it.</p><button className="animalNext" type="button" onClick={() => { setPlayKind("random"); switchBoard(mode); }}>Play a random candidate</button></section> : <>
      <div className="animalBoardTop">
        <div><span className="animalEyebrow">{playKind.toUpperCase()} · BOARD {boardIndex + 1} OF {pool.length} · {board.boardType.toUpperCase()}</span>
          <h2>{submitted ? "Your results" : board.title ?? "Make your matches"}</h2></div>
        <button type="button" className="animalNext" onClick={nextBoard}>Another board →</button>
      </div>
      <p className="animalPilotNote">{playKind === "daily" ? `Reviewed daily board · ${date}` : "Random playtest candidate. Values are sourced; this board has not yet been approved for daily play."} <a href="/animals/review">Comparison review</a></p>
      {!submitted && <>
        <div className="animalToolbar"><p className="animalInstruction">Choose an animal and a trait in either order, or drag to place. Occupied slots swap your choices.</p>
          <button type="button" className="animalNext" onClick={() => { setAssignments({}); setSelectedAnimal(null); setSelectedTrait(null); setMessage(""); }}>Reset choices</button>
        </div>

        <div className="animalPlayBoard">
        <section className="animalTraits" aria-label="Traits">
          {board.traitIds.map((id) => {
            const trait = traitMap.get(id)!;
            const animal = animalMap.get(assignments[id]);
            return <button type="button" key={id} data-trait-id={id} className={`animalTrait ${selectedTrait === id || dropTarget === id ? "selected" : ""}`}
              aria-pressed={selectedTrait === id} onClick={() => selectedAnimal ? assign(id, selectedAnimal) : setSelectedTrait(selectedTrait === id ? null : id)}>
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
            return <button type="button" key={id} aria-pressed={selectedAnimal === id} className={`animalCard ${usedOn ? "used" : ""} ${selectedAnimal === id ? "selected" : ""}`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                pointer.current = { id, x: event.clientX, y: event.clientY, moved: false };
                suppressClick.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const start = pointer.current;
                if (!start || start.id !== id) return;
                if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8 && !start.moved) return;
                start.moved = true;
                setDragging({ id, x: event.clientX, y: event.clientY });
                setDropTarget(document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-trait-id]")?.dataset.traitId ?? null);
              }}
              onPointerUp={(event) => {
                const start = pointer.current;
                if (start?.moved) {
                  suppressClick.current = true;
                  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-trait-id]")?.dataset.traitId;
                  if (target) assign(target, id);
                }
                pointer.current = null; setDragging(null); setDropTarget(null);
              }}
              onPointerCancel={() => { pointer.current = null; setDragging(null); setDropTarget(null); }}
              onClick={() => {
                if (suppressClick.current) { suppressClick.current = false; return; }
                if (selectedTrait) assign(selectedTrait, id);
                else { setSelectedAnimal(selectedAnimal === id ? null : id); setMessage(""); }
              }}>
              <img src={photo.assetUrl} alt="" draggable={false} />
              <span>{animal.commonName}</span><small>{animal.scientificName}</small>
              {usedOn && <em>Assigned to {traitMap.get(usedOn)?.displayName}</em>}
            </button>;
          })}
        </section>
        </div>
        {dragging && <div className="animalDragGhost" style={{ left: dragging.x + 12, top: dragging.y + 12 }}>{animalMap.get(dragging.id)?.commonName}</div>}
        <div className="animalSubmit"><button type="button" onClick={() => {
          if (Object.keys(assignments).length < board.traitIds.length) {
            setMessage(`Choose an animal for all ${board.traitIds.length} traits first.`); return;
          }
          setSubmitted(true);
          setMessage("");
          saveResult();
        }}>Reveal results</button>{message && <p role="status">{message}</p>}<span className="animalProgress" aria-live="polite">{Object.keys(assignments).length} / {board.traitIds.length} placed</span></div>
      </>}
      {submitted && <>
        {accountMessage && <p role="status" className="animalSaveStatus">{accountMessage}</p>}
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
                <details><summary>Definition and source</summary><p>{trait.definition}. {source.name}, {source.versionYear}. <a href={source.url} target="_blank" rel="noreferrer">View dataset</a>.</p><p>{selected.value.notes}</p><p>Uncertainty: {selected.value.uncertaintyStatus === "reported" ? "reported source ranges checked; these are not confidence intervals" : "the source does not supply an uncertainty interval for this value"}.</p></details>
              </div>
            </article>;
          })}
        </section>
        <div className="animalActions"><button type="button" onClick={nextBoard}>Try another board</button>
          <button type="button" className="animalNext" onClick={async () => {
            const message = `Countries, Animals & Things\nAnimalStats ${config.label} · ${playKind} · ${date}\n${total}/${config.maxScore} · ${optimalChoices} Optimal Choices\n${results.map((row) => row.rank === 1 ? "🎯" : row.points >= 50 ? "🟩" : "🟨").join("")}\n${window.location.origin}/animals`;
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
      </>}
      <footer className="animalFooter"><p>Data: <a href="https://genomics.senescence.info/species/" target="_blank" rel="noreferrer">AnAge / HAGR</a> and <a href="https://doi.org/10.6084/m9.figshare.16586228.v7" target="_blank" rel="noreferrer">AVONET</a>, <a href="https://doi.org/10.6084/m9.figshare.4644424.v5" target="_blank" rel="noreferrer">AmphiBIO</a> and <a href="https://doi.org/10.6084/m9.figshare.3563457.v1" target="_blank" rel="noreferrer">Amniote life histories</a>. Photos: Wikimedia Commons; individual credits below.</p>
        <details><summary>Photo credits</summary><ul>{board?.animalIds.map((id) => { const photo = photoMap.get(id)!; return <li key={id}><a href={photo.originalUrl} target="_blank" rel="noreferrer">{animalMap.get(id)?.commonName}</a>: {photo.attribution}</li>; })}</ul></details>
        <p>Private experimental prototype. AnimalStats history is kept separate from Countries. Sign in to save future results to your account.</p></footer>
    </div>
  </main>;
}
