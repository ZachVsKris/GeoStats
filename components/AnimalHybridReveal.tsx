"use client";

import { useState, type CSSProperties } from "react";
import type { Animal } from "../lib/animalstats";
import { AnimalSprite, hybridName } from "./AnimalSprite";

export function AnimalHybridReveal({ chosen, correct, traitName, rank, index }: { chosen: Animal; correct: Animal; traitName: string; rank: number; index: number }) {
 const [replay, setReplay] = useState(0);
 const matched = chosen.id === correct.id;
 return <article className={`hybridPodium ${matched ? "hybridMatch" : ""}`} aria-label={`${traitName} offspring`}>
  <div className="hybridHeading"><span>{rank === 1 ? "PERFECT MATCH" : `YOUR CHOICE · ${rank}${rank === 2 ? "ND" : rank === 3 ? "RD" : "TH"} PLACE`}</span><h3>{traitName}</h3></div>
  <div key={replay} className="hybridArena" style={{ "--reveal-delay": `${index * .16}s` } as CSSProperties}>
   <div className="hybridParent hybridParentChosen"><AnimalSprite animal={chosen}/><span>Your choice</span></div>
   <div className="hybridParent hybridParentCorrect"><AnimalSprite animal={correct}/><span>Correct answer</span></div>
   <div className="hybridHearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></div>
   <div className="hybridPoof" aria-hidden="true">✦</div>
   <div className="hybridBaby"><AnimalSprite animal={chosen} headAnimal={correct} baby/><span className="hybridSpark hybridSparkOne" aria-hidden="true">✧</span><span className="hybridSpark hybridSparkTwo" aria-hidden="true">✧</span></div>
  </div>
  <div className="hybridPlinth"><span className="hybridNewLabel">{matched ? "A LITTLE WINNER" : "YOUR NEW HYBRID"}</span><strong>{hybridName(chosen, correct)}</strong><p>{matched ? `Two ${chosen.commonName.toLowerCase()}s. One tiny champion.` : `${chosen.commonName} × ${correct.commonName}`}</p></div>
  <button type="button" className="hybridReplay" aria-label={`Replay ${traitName} hybrid animation`} onClick={() => setReplay(replay + 1)}>↻ Replay reveal</button>
 </article>;
}
