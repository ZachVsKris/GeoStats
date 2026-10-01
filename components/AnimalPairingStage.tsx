"use client";
import { useEffect, useRef } from "react";
import type { Animal } from "../lib/animalstats";
import { mountAnimalPairing } from "../lib/animalstats3d";
import { animalLifeCycle } from "../lib/animalstatsLifeCycle";
export function AnimalPairingStage({
  chosen,
  correct,
  enabled,
}: {
  chosen: Animal;
  correct: Animal;
  enabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { birth, pairing } = animalLifeCycle(chosen);
  useEffect(() => {
    if (enabled && canvas.current)
      return mountAnimalPairing(
        canvas.current,
        chosen.id,
        correct.id,
        pairing,
        birth,
      );
  }, [chosen.id, correct.id, pairing, birth, enabled]);
  return (
    <canvas
      ref={canvas}
      width={640}
      height={360}
      className="pairingCanvas"
      role="img"
      aria-label={`${chosen.commonName} and ${correct.commonName}: mating, then ${birth === "egg" ? "egg laying and hatching" : "birth"}`}
      data-chosen-id={chosen.id}
      data-correct-id={correct.id}
      data-birth-mode={birth}
      data-pairing-behavior={pairing}
    />
  );
}
