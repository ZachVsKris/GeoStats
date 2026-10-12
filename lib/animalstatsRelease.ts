import seal from "../data/animalstats/research/release-validation-seal.json";
import { animalReleaseFingerprint } from "./animalstatsReleaseFingerprint";
import { animalDataset, animalCandidates, animalPhotos } from "./animalstatsCatalog";
import { createAnimalBoardValidator, type AnimalDataset, type BoardCandidate } from "./animalstats";
import { publishedAnimalTraitIds } from "./animalstatsCoverage";
import { animalBoardComposition } from "./animalstatsComposition";

let release: { data: AnimalDataset; boards: BoardCandidate[]; defaultBoards: BoardCandidate[]; clientData: AnimalDataset; validation: "build-audit" | "runtime" } | undefined;
/** One immutable, validated snapshot shared by the page and board API. */
export function getAnimalRelease() {
  if (release) return release;
  const data = animalDataset;
  const fingerprint = animalReleaseFingerprint(data, animalCandidates.boards);
  const sealed = seal.version === 1 && fingerprint.dataSha256 === seal.dataSha256 && fingerprint.boardsSha256 === seal.boardsSha256;
  const validate = sealed ? () => ({ valid: true }) : createAnimalBoardValidator(data);
  const published = publishedAnimalTraitIds(data);
  const traits = data.traits.filter(t => t.prototypeCategory && published.has(t.id) && !t.id.startsWith("adult_shoulder_height"));
  const ids = new Set(traits.map(t => t.id));
  const boards = animalCandidates.boards.filter(b => b.traitIds.every(id => ids.has(id)) && validate(b).valid);
  const defaultBoards = boards.filter(b => animalBoardComposition(data, b).eligible);
  const clientData = { ...data, traits, photos: animalPhotos.filter(p => p.approved && p.assetUrl.startsWith("/animalstats/") && (!p.assetUrl.endsWith(".svg") || p.assetUrl.startsWith("/animalstats/extinct/"))), values: data.values.filter(v => ids.has(v.traitId) && v.confidence === 'approved' && v.observationType !== 'imputed').map(v => ({
    animalId: v.animalId, traitId: v.traitId, valueNumeric: v.valueNumeric, unit: v.unit,
    sourceId: v.sourceId, confidence: v.confidence, observationType: v.observationType,
    sex: v.sex, lifeStage: v.lifeStage, valueMin: v.valueMin, valueMax: v.valueMax,
    notes: "", measurementBasis: "",
  })) };
  return release = { data, boards, defaultBoards, clientData, validation: sealed ? "build-audit" : "runtime" };
}
