"use client";
import { memo, useEffect, useRef } from "react";
import type { Animal } from "../lib/animalstats";
import { mountAnimal } from "../lib/animalstats3d";
export const AnimalSprite = memo(function AnimalSprite({
  animal,
  headAnimal,
  baby = false,
  className = "",
}: {
  animal: Animal;
  headAnimal?: Animal;
  baby?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const headId = headAnimal?.id ?? animal.id;
  useEffect(() => {
    if (!ref.current) return;
    return mountAnimal(ref.current, animal.id, headId, baby);
  }, [animal.id, headId, baby]);
  const hybrid = headId !== animal.id;
  const label = hybrid
    ? `${animal.commonName} body with ${headAnimal!.commonName} head — fictional hybrid`
    : `${baby ? "Baby " : ""}${animal.commonName}`;
  return (
    <canvas
      ref={ref}
      width={360}
      height={320}
      className={`animalSprite livingCharacter ${baby ? "spriteBaby" : ""} ${className}`}
      role="img"
      aria-label={label}
      data-animal-id={animal.id}
      data-head-animal-id={headId}
      data-art-version="living-3d-v4"
      data-normalized-size="142"
    />
  );
});
export function hybridName(first: Animal, second: Animal) {
  if (first.id === second.id) return `Baby ${first.commonName.toLowerCase()}`;
  const a = first.commonName.split(" ").at(-1)!;
  const b = second.commonName.split(" ").at(-1)!;
  return `${a.slice(0, Math.max(2, Math.ceil(a.length / 2)))}${b.slice(Math.floor(b.length / 2)).toLowerCase()}`;
}
