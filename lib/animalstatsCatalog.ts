import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assembleAnimalDataset } from "./animalstatsDatasetAssembly";
import type { AnimalDataset, AnimalPhoto, BoardCandidate } from "./animalstats";

// Read frozen source files verbatim: production JSON compilation can round
// floating-point literals and invalidate both release and Daily fingerprints.
function snapshot<T>(name: string): T {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "animalstats", name + ".json"), "utf8")) as T;
}
const pilot = snapshot<AnimalDataset>("pilot");
const photos = snapshot<AnimalPhoto[]>("photos");
const coverage = snapshot<AnimalDataset>("existing-coverage");
const spatial = snapshot<AnimalDataset>("tetrapod-spatial");
const marine = snapshot<AnimalDataset>("marine");
const aquaticEggs = snapshot<AnimalDataset>("aquatic-eggs");
const fish = snapshot<AnimalDataset>("fish-records");
const underrepresented = snapshot<AnimalDataset>("underrepresented");
const ladybirds = snapshot<AnimalDataset>("insect-ladybirds");
const extinct = snapshot<AnimalDataset & { boards: BoardCandidate[] }>("extinct");
const candidates = snapshot<{ boards: BoardCandidate[] }>("candidates");
const groupBoards = snapshot<{ boards: BoardCandidate[] }>("group-boards");
const additionalGroupBoards = snapshot<{ boards: BoardCandidate[] }>("group-boards-2");

// Separate source snapshots keep the living catalog intact and make the special
// collection independently reviewable. Validation still runs on every board.
export const animalDataset = assembleAnimalDataset([pilot, coverage, fish, spatial, marine, aquaticEggs, underrepresented, ladybirds, extinct], marine.photos);
export const animalPhotos = [...photos, ...coverage.photos, ...fish.photos, ...marine.photos, ...underrepresented.photos, ...ladybirds.photos, ...extinct.photos];
export const animalCandidates = { boards: [...candidates.boards, ...groupBoards.boards, ...additionalGroupBoards.boards, ...extinct.boards] };
