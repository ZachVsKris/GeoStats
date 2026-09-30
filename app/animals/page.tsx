import { animalPreviewEnabled } from "../../lib/animalstatsPreview";
import { notFound } from "next/navigation";
import AnimalStatsGame from "../../components/AnimalStatsGame";
import dataset from "../../data/animalstats/pilot.json";
import reviews from "../../data/animalstats/reviews.json";
import { approvedAnimalBoards, type AnimalBoardReview } from "../../lib/animalstatsReview";
import candidates from "../../data/animalstats/candidates.json";
import { validateAnimalBoard, type AnimalDataset, type BoardCandidate } from "../../lib/animalstats";
import { orderAnimalPilotBoards } from "../../lib/animalstatsDaily";
import { newYorkDate } from "../../lib/time";

export const metadata = { title: "AnimalStats private prototype", robots: { index: false, follow: false }, alternates: { canonical: "/animals" } };
export const dynamic = "force-dynamic";

export default function AnimalStatsPage() {
  // Read at request time so promoting a preview build cannot expose the pilot.
  if (!animalPreviewEnabled()) notFound();
  const data = dataset as AnimalDataset;
  const boards = (candidates.boards as BoardCandidate[]).filter((board) => validateAnimalBoard(data, board).valid);
  if (!boards.length) notFound();
  const pairedTraits = data.traits.filter((trait) => trait.prototypeCategory);
  const pairedIds = new Set(pairedTraits.map((trait) => trait.id));
  const clientData = { ...data, traits: pairedTraits, values: data.values.filter((row) => pairedIds.has(row.traitId)) };
  return <AnimalStatsGame data={clientData} boards={orderAnimalPilotBoards(boards, newYorkDate(), data)} approvedBoardIds={approvedAnimalBoards(data, boards, reviews as AnimalBoardReview[]).map((board) => board.id!)} date={newYorkDate()} />;
}
