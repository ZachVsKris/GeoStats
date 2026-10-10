import pilot from "../data/animalstats/pilot.json";
import photos from "../data/animalstats/photos.json";
import candidates from "../data/animalstats/candidates.json";
import fish from "../data/animalstats/fish-records.json";
import extinct from "../data/animalstats/extinct.json";
import groupBoards from "../data/animalstats/group-boards.json";
import type { AnimalDataset, AnimalPhoto, BoardCandidate } from "./animalstats";

// Separate source snapshots keep the living catalog intact and make the special
// collection independently reviewable. Validation still runs on every board.
export const animalDataset = Object.fromEntries(
  (["animals", "traits", "values", "sources", "photos"] as const).map(key => [key, [...pilot[key], ...fish[key], ...extinct[key]]])
) as AnimalDataset;
export const animalPhotos = [...photos, ...extinct.photos] as AnimalPhoto[];
export const animalCandidates = { boards: [...candidates.boards, ...groupBoards.boards, ...extinct.boards] as BoardCandidate[] };
