"use client";

import type { Animal, AnimalPhoto } from "../lib/animalstats";
import { AnimalSprite } from "./AnimalSprite";
import frames from "../data/animalstats/photo-framing.json";

export default function AnimalPortrait({ animal, photo, presentation }: { animal: Animal; photo?: AnimalPhoto; presentation: "cute" | "real" }) {
  const frame = (frames as Record<string, { fit: string; x: number; y: number }>)[animal.id];
  return presentation === "cute" ? <AnimalSprite animal={animal} /> : photo && !photo.assetUrl.endsWith(".svg") ? <img className="animalRealPhoto" src={photo.assetUrl} alt={animal.commonName} title={`${photo.attribution}${frame?.fit === "cover" ? " · Cropped for display" : ""}`} style={{ objectFit: frame?.fit === "contain" ? "contain" : "cover", objectPosition: `${frame?.x ?? 50}% ${frame?.y ?? 50}%` }} draggable={false} /> : <span className="animalPhotoUnavailable" aria-label={`Photo unavailable for ${animal.commonName}`}>🐾</span>;
}
