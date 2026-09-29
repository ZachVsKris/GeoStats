import { validateAnimalBoard, type AnimalDataset, type BoardCandidate } from "./animalstats";

export type AnimalBoardReview = {
  boardId: string;
  status: "approved" | "hold" | "rejected";
  reviewer: string;
  reviewedAt: string;
  sourceChecks: string;
  uncertaintyChecks: string;
  playabilityChecks: string;
  fingerprint: string;
  dataFingerprint: string;
};

export function animalBoardFingerprint(board: BoardCandidate) {
  return `${board.mode}|${board.boardType}|${board.animalIds.join(",")}|${board.traitIds.join(",")}`;
}

export function animalBoardDataFingerprint(data: AnimalDataset, board: BoardCandidate) {
  const traits = board.traitIds.map((id) => data.traits.find((trait) => trait.id === id));
  const observations = board.traitIds.flatMap((traitId) => board.animalIds.map((animalId) => data.values.find((value) => value.animalId === animalId && value.traitId === traitId)));
  const photos = board.animalIds.map((id) => data.photos.find((photo) => photo.animalId === id));
  const animals = board.animalIds.map((id) => data.animals.find((animal) => animal.id === id));
  const sources = [...new Set(traits.map((trait) => trait?.canonicalSourceId))].map((id) => data.sources.find((source) => source.id === id));
  return JSON.stringify({ animals, traits, sources, observations, photos });
}

export function approvedAnimalBoards(data: AnimalDataset, boards: BoardCandidate[], reviews: AnimalBoardReview[]) {
  return boards.filter((board) => reviews.some((review) => review.boardId === board.id &&
    review.status === "approved" && Number.isFinite(Date.parse(review.reviewedAt)) && review.fingerprint === animalBoardFingerprint(board) && review.dataFingerprint === animalBoardDataFingerprint(data, board) &&
    [review.reviewer, review.reviewedAt, review.sourceChecks, review.uncertaintyChecks, review.playabilityChecks].every((value) => Boolean(value.trim()))) &&
    validateAnimalBoard(data, board).valid);
}
