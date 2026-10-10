import pilot from "../data/animalstats/pilot.json";
import photos from "../data/animalstats/photos.json";
import candidates from "../data/animalstats/candidates.json";
import coverage from "../data/animalstats/existing-coverage.json";
import spatial from "../data/animalstats/tetrapod-spatial.json";
import marine from "../data/animalstats/marine.json";
import aquaticEggs from "../data/animalstats/aquatic-eggs.json";
import fish from "../data/animalstats/fish-records.json";
import extinct from "../data/animalstats/extinct.json";
import groupBoards from "../data/animalstats/group-boards.json";
import additionalGroupBoards from "../data/animalstats/group-boards-2.json";
import type { AnimalDataset, AnimalPhoto, BoardCandidate } from "./animalstats";

// Separate source snapshots keep the living catalog intact and make the special
// collection independently reviewable. Validation still runs on every board.
export const animalDataset = Object.fromEntries(
  (["animals", "traits", "values", "sources", "photos"] as const).map(key => [key, [...(key === "photos" ? pilot.photos.filter(photo => !marine.photos.some(newPhoto => newPhoto.animalId === photo.animalId)) : pilot[key]), ...coverage[key], ...fish[key], ...spatial[key], ...marine[key], ...aquaticEggs[key], ...extinct[key]]])
) as AnimalDataset;
export const animalPhotos = [...photos, ...coverage.photos, ...fish.photos, ...marine.photos, ...extinct.photos] as AnimalPhoto[];
export const animalCandidates = { boards: [...candidates.boards, ...groupBoards.boards, ...additionalGroupBoards.boards, ...extinct.boards] as BoardCandidate[] };
