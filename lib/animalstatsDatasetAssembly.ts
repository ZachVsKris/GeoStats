import type { AnimalDataset } from "./animalstats";
/** Preserve source order and the explicitly reviewed marine photo overrides. */
export function assembleAnimalDataset(parts: AnimalDataset[], marinePhotos: AnimalDataset["photos"]): AnimalDataset {
  return {
    animals: parts.flatMap(part => part.animals),
    traits: parts.flatMap(part => part.traits),
    values: parts.flatMap(part => part.values),
    sources: parts.flatMap(part => part.sources),
    photos: parts.flatMap((part, index) => index === 0 ? part.photos.filter(photo => !marinePhotos.some(override => override.animalId === photo.animalId)) : part.photos),
  };
}
