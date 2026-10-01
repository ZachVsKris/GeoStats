"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Animal } from "../lib/animalstats";
import { AnimalSprite, hybridName } from "./AnimalSprite";

export function AnimalHybridReveal({ chosen, correct, traitName, rank, index }: { chosen: Animal; correct: Animal; traitName: string; rank: number; index: number }) {
 const [replay, setReplay] = useState(0);
 const [started, setStarted] = useState(false);
 const arena = useRef<HTMLDivElement>(null);
 useEffect(() => {
  if (!arena.current || started) return;
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setStarted(true); observer.disconnect(); } }, { threshold: .3 });
  observer.observe(arena.current);
  return () => observer.disconnect();
 }, [started]);
 const matched = chosen.id === correct.id;
 return <article className={`hybridPodium ${matched ? "hybridMatch" : ""}`} aria-label={`${traitName} offspring`}>
  <div className="hybridHeading"><span>{rank === 1 ? "PERFECT MATCH" : `YOUR CHOICE · ${rank}${rank === 2 ? "ND" : rank === 3 ? "RD" : "TH"} PLACE`}</span><h3>{traitName}</h3></div>
  <div key={replay} ref={arena} data-started={started} className="hybridArena" style={{ "--reveal-delay": `${index * .16}s` } as CSSProperties}>
   <div className="hybridParent hybridParentChosen"><AnimalSprite animal={chosen}/><span>Your choice</span></div>
   <div className="hybridParent hybridParentCorrect"><AnimalSprite animal={correct}/><span>Correct answer</span></div>
   <div className="hybridHearts" aria-hidden="true"><i>♥</i><i>♥</i><i>♥</i></div>
   <div className="hybridNest" aria-hidden="true"><svg viewBox="0 0 160 45"><ellipse cx="80" cy="27" rx="70" ry="13" fill="#c5a66e"/><path d="m17 22 33 17m-21-23 40 24m-22-26 41 27m-22-27 35 26m-13-27 27 25m-8-27 23 22m-89-3 62 2m-52-8 72 3m-56-12 67 4" stroke="#eed7a1" strokeWidth="3" strokeLinecap="round"/></svg></div>
   <div className="hybridEgg" aria-hidden="true">
    {["Left", "Right"].map(side => <svg key={side} className={`hybridEggHalf eggShell${side}`} viewBox="0 0 120 140"><path d="M60 8C33 8 12 61 12 94c0 26 20 38 48 38s48-12 48-38C108 61 87 8 60 8Z" fill="#fff7dd" stroke="#c9ad7b" strokeWidth="2.5"/><ellipse cx="40" cy="65" rx="7" ry="9" fill="#e5cfac"/><ellipse cx="77" cy="92" rx="8" ry="6" fill="#e5cfac"/><path d="m60 20-8 21 16 16-13 17 15 22-12 27" fill="none" stroke="#bfa276" strokeWidth="2" className="hybridEggCrack"/></svg>)}
   </div>
   <div className="hybridBirthCaption" aria-hidden="true"><span className="birthMeet">A perfect little meet-cute…</span><span className="birthMix">A new mix is on the way…</span><span className="birthHello">Hello, little one!</span></div>
   <div className="hybridPoof" aria-hidden="true">✦</div>
   <div className="hybridBaby"><AnimalSprite animal={chosen} headAnimal={correct} baby/><span className="hybridSpark hybridSparkOne" aria-hidden="true">✧</span><span className="hybridSpark hybridSparkTwo" aria-hidden="true">✧</span></div>
  </div>
  <div className="hybridPlinth"><span className="hybridNewLabel">{matched ? "A LITTLE WINNER" : "YOUR NEW HYBRID"}</span><strong>{hybridName(chosen, correct)}</strong><p>{matched ? `Two ${chosen.commonName.toLowerCase()}s. One tiny champion.` : `${chosen.commonName} × ${correct.commonName}`}</p></div>
  <button type="button" className="hybridReplay" aria-label={`Replay ${traitName} hybrid animation`} onClick={() => setReplay(previous => previous + 1)}>↻ Replay birth</button>
 </article>;
}
