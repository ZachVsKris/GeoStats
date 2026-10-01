"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Animal } from "../lib/animalstats";
import { animalLifeCycle } from "../lib/animalstatsLifeCycle";
import { AnimalSprite, hybridName } from "./AnimalSprite";
import { AnimalPairingStage } from "./AnimalPairingStage";
export function AnimalHybridReveal({
  chosen,
  correct,
  traitName,
  rank,
  index,
}: {
  chosen: Animal;
  correct: Animal;
  traitName: string;
  rank: number;
  index: number;
}) {
  const [replay, setReplay] = useState(0),
    [started, setStarted] = useState(false);
  const arena = useRef<HTMLDivElement>(null);
  const life = animalLifeCycle(chosen);
  useEffect(() => {
    if (!arena.current || started) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.7,
          )
        ) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.7 },
    );
    observer.observe(arena.current);
    return () => observer.disconnect();
  }, [started]);
  const matched = chosen.id === correct.id;
  return (
    <article
      className={`hybridPodium ${matched ? "hybridMatch" : ""}`}
      aria-label={`${traitName} offspring`}
    >
      <div className="hybridHeading">
        <span>
          {rank === 1
            ? "PERFECT MATCH"
            : `YOUR CHOICE · ${rank}${rank === 2 ? "ND" : rank === 3 ? "RD" : "TH"} PLACE`}
        </span>
        <h3>{traitName}</h3>
      </div>
      <div
        key={replay}
        ref={arena}
        data-started={started}
        data-birth-mode={life.birth}
        data-pairing-behavior={life.pairing}
        className="hybridArena"
        style={{ "--reveal-delay": `${index * 0.1}s` } as CSSProperties}
      >
        {life.pairing === "water" && (
          <div className="breedingWater" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        <AnimalPairingStage
          chosen={chosen}
          correct={correct}
          enabled={started}
        />
        <div className="hybridParent hybridParentChosen">
          {started && <AnimalSprite animal={chosen} />}
          <span>Your choice</span>
        </div>
        <div className="hybridParent hybridParentCorrect">
          {started && <AnimalSprite animal={correct} />}
          <span>Correct answer</span>
        </div>
        <div
          className={`hybridNest ${life.birth === "egg" ? "" : "birthDen"}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 160 45">
            <ellipse
              cx="80"
              cy="27"
              rx="70"
              ry="13"
              fill={life.birth === "egg" ? "#c5a66e" : "#91a26c"}
            />
            <path
              d="m17 22 33 17m-21-23 40 24m-22-26 41 27m-22-27 35 26m-13-27 27 25m-8-27 23 22m-89-3 62 2m-52-8 72 3m-56-12 67 4"
              stroke={life.birth === "egg" ? "#eed7a1" : "#ccd7a5"}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {life.birth === "egg" && (
          <div className="hybridEgg" aria-hidden="true">
            {["Left", "Right"].map((side) => (
              <svg
                key={side}
                className={`hybridEggHalf eggShell${side}`}
                viewBox="0 0 120 140"
              >
                <path
                  d="M60 8C33 8 12 61 12 94c0 26 20 38 48 38s48-12 48-38C108 61 87 8 60 8Z"
                  fill="#fff7dd"
                  stroke="#c9ad7b"
                  strokeWidth="2.5"
                />
                <ellipse cx="40" cy="65" rx="7" ry="9" fill="#e5cfac" />
                <ellipse cx="77" cy="92" rx="8" ry="6" fill="#e5cfac" />
                <path
                  d="m60 20-8 21 16 16-13 17 15 22-12 27"
                  fill="none"
                  stroke="#bfa276"
                  strokeWidth="2"
                  className="hybridEggCrack"
                />
              </svg>
            ))}
          </div>
        )}
        <div className="hybridBirthCaption" aria-hidden="true">
          <span className="birthMeet">Getting acquainted…</span>
          <span className="birthMate">Mating</span>
          <span className="birthMix">Later…</span>
          <span className="birthArrival">
            {life.birth === "egg"
              ? "An egg is laid…"
              : life.birth === "pouch"
                ? "Birth, then into the pouch…"
                : "A little one is born…"}
          </span>
          <span className="birthHello">
            {life.birth === "egg"
              ? "Hatching. Hello, little one!"
              : "Hello, little one!"}
          </span>
        </div>
        <div className="hybridBaby">
          <AnimalSprite animal={chosen} headAnimal={correct} baby />
        </div>
      </div>
      <div className="hybridPlinth">
        <span className="hybridNewLabel">
          {matched ? "A LITTLE WINNER" : "YOUR NEW HYBRID"}
        </span>
        <strong>{hybridName(chosen, correct)}</strong>
        <p>
          {matched
            ? `Two ${chosen.commonName.toLowerCase()}s. One tiny champion.`
            : `${chosen.commonName} × ${correct.commonName}`}
        </p>
      </div>
      <button
        type="button"
        className="hybridReplay"
        aria-label={`Replay ${traitName} hybrid animation`}
        onClick={() => setReplay((previous) => previous + 1)}
      >
        ↻ Replay breeding & birth
      </button>
    </article>
  );
}
