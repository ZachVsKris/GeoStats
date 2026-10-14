"use client";

import type { Animal, AnimalPhoto } from "../lib/animalstats";
import { AnimalSprite } from "./AnimalSprite";
import frames from "../data/animalstats/photo-framing.json";

export default function AnimalPortrait({ animal, photo, presentation }: { animal: Animal; photo?: AnimalPhoto; presentation: "cute" | "real" }) {
  const frame = (frames as Record<string, { fit: string; x: number; y: number }>)[animal.id];
  if (animal.extinctionStatus === "extinct" && presentation === "cute") return <AnimalSprite animal={animal} />;
  // Extinct Static assets are matched to the exact species, never the genus.
  // Keep the full mounted skeleton visible, with the same frame as other animals.
  if (animal.extinctionStatus === "extinct" && photo?.approved && !photo.assetUrl.endsWith(".svg")) return <img className="animalRealPhoto" src={photo.assetUrl} alt={`${animal.commonName} · mounted skeleton`} title={photo.attribution} style={{objectFit:"contain"}} draggable={false} />;
  if (animal.extinctionStatus === "extinct") return <img className="animalRealPhoto" src={`/animalstats/extinct/${animal.scientificName.split(" ")[0].toLowerCase()}.svg`} alt={`${animal.commonName} · illustration; Static specimen image pending`} title="Illustration placeholder · specimen image awaiting review" style={{objectFit:"contain"}} draggable={false} />;
  return presentation === "cute" ? <AnimalSprite animal={animal} /> : photo && !photo.assetUrl.endsWith(".svg") ? <img className="animalRealPhoto" src={photo.assetUrl} alt={animal.commonName} title={`${photo.attribution}${frame?.fit === "cover" ? " · Cropped for display" : ""}`} style={{ objectFit: frame?.fit === "contain" ? "contain" : "cover", objectPosition: `${frame?.x ?? 50}% ${frame?.y ?? 50}%` }} draggable={false} /> : <span className="animalPhotoUnavailable" aria-label={`Photo unavailable for ${animal.commonName}`}>🐾</span>;
}
