"use client";

import type { Animal, AnimalPhoto } from "../lib/animalstats";
import { AnimalSprite } from "./AnimalSprite";

export default function AnimalPortrait({ animal, photo, presentation }: { animal: Animal; photo?: AnimalPhoto; presentation: "cute" | "real" }) {
  return presentation === "cute" ? <AnimalSprite animal={animal} /> : photo && !photo.assetUrl.endsWith(".svg") ? <img className="animalRealPhoto" src={photo.assetUrl} alt={animal.commonName} title={photo.attribution} draggable={false} /> : <span className="animalPhotoUnavailable" aria-label={`Photo unavailable for ${animal.commonName}`}>🐾</span>;
}
