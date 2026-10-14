"use client";

import type { Animal, AnimalPhoto } from "../lib/animalstats";
import { AnimalSprite } from "./AnimalSprite";
import frames from "../data/animalstats/photo-framing.json";
import portraits from "../data/animalstats/gameplay-portraits.json";

export default function AnimalPortrait({ animal, photo, presentation, gameplay = false }: { animal: Animal; photo?: AnimalPhoto; presentation: "cute" | "real"; gameplay?: boolean }) {
  // Never display a relative's photo or an unreviewed asset passed by a caller.
  if (photo && (photo.animalId !== animal.id || !photo.approved)) photo = undefined;
  const portrait = (portraits as Record<string, { scientificName: string; assetUrl: string; sourceWidth: number; sourceHeight: number; crop: number[] }>)[animal.id];
  if (gameplay && presentation === "real" && photo && portrait?.scientificName === animal.scientificName && portrait.assetUrl === photo.assetUrl) {
    // A source-coordinate viewport crops without warping the animal. Use the
    // same reviewed viewport in the bank, assigned pieces, gallery and drag ghost.
    return <svg className="animalRealPhoto animalGameplayPortrait" viewBox={portrait.crop.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={animal.commonName} data-portrait-animal={animal.id}>
      <title>{`${animal.commonName} · identification portrait · ${photo.attribution}`}</title>
      <image href={photo.assetUrl} width={portrait.sourceWidth} height={portrait.sourceHeight} />
    </svg>;
  }
  const frame = (frames as Record<string, { fit: string; x: number; y: number }>)[animal.id];
  if (animal.extinctionStatus === "extinct" && presentation === "cute") return <AnimalSprite animal={animal} />;
  // Extinct Static assets are matched to the exact species, never the genus.
  // Keep the full mounted skeleton visible, with the same frame as other animals.
  if (animal.extinctionStatus === "extinct" && photo?.approved && !photo.assetUrl.endsWith(".svg")) return <img className="animalRealPhoto" src={photo.assetUrl} alt={`${animal.commonName} · mounted skeleton`} title={photo.attribution} style={{objectFit:"contain"}} draggable={false} />;
  if (animal.extinctionStatus === "extinct") return <img className="animalRealPhoto" src={`/animalstats/extinct/${animal.scientificName.split(" ")[0].toLowerCase()}.svg`} alt={`${animal.commonName} · illustration; Static specimen image pending`} title="Illustration placeholder · specimen image awaiting review" style={{objectFit:"contain"}} draggable={false} />;
  return presentation === "cute" ? <AnimalSprite animal={animal} /> : photo && !photo.assetUrl.endsWith(".svg") ? <img className="animalRealPhoto" src={photo.assetUrl} alt={animal.commonName} title={`${photo.attribution}${frame?.fit === "cover" ? " · Cropped for display" : ""}`} style={{ objectFit: frame?.fit === "contain" ? "contain" : "cover", objectPosition: `${frame?.x ?? 50}% ${frame?.y ?? 50}%` }} draggable={false} /> : <span className="animalPhotoUnavailable" aria-label={`Photo unavailable for ${animal.commonName}`}>🐾</span>;
}
