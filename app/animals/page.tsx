import { animalPreviewEnabled } from "../../lib/animalstatsPreview";
import { notFound } from "next/navigation";
import AnimalStatsGame from "../../components/AnimalStatsGame";
import dataset from "../../data/animalstats/pilot.json";
import reviews from "../../data/animalstats/reviews.json";
import { approvedAnimalBoards, type AnimalBoardReview } from "../../lib/animalstatsReview";
import candidates from "../../data/animalstats/candidates.json";
import { createAnimalBoardValidator, type AnimalDataset, type BoardCandidate } from "../../lib/animalstats";
import { orderAnimalPilotBoards } from "../../lib/animalstatsDaily";
import { newYorkDate } from "../../lib/time";

export const metadata = { title: "AnimalStats private prototype", robots: { index: false, follow: false }, alternates: { canonical: "/animals" } };
export const dynamic = "force-dynamic";

// These imports are immutable source snapshots. Validate once per worker, not once per visitor.
let catalog: { data: AnimalDataset; boards: BoardCandidate[]; clientData: AnimalDataset } | undefined;
function getCatalog() {
  if (catalog) return catalog;
  const data = dataset as AnimalDataset;
  const validate = createAnimalBoardValidator(data);
  const excluded = new Set(["adult_shoulder_height", "adult_shoulder_height__low"]);
  const boards = (candidates.boards as BoardCandidate[]).filter((board) => !board.traitIds.some(id => excluded.has(id)) && validate(board).valid);
  const pairedTraits = data.traits.filter((trait) => trait.prototypeCategory && !excluded.has(trait.id));
  const pairedIds = new Set(pairedTraits.map((trait) => trait.id));
  const clientData = { ...data, traits: pairedTraits, values: data.values.filter((row) => pairedIds.has(row.traitId)) };
  catalog = { data, boards, clientData };
  return catalog;
}

export default async function AnimalStatsPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const requested = await searchParams;
  // Read at request time so promoting a preview build cannot expose the pilot.
  if (!animalPreviewEnabled()) notFound();
  const { data, boards, clientData } = getCatalog();
  if (!boards.length) notFound();
  return <AnimalStatsGame initialBoardId={requested.board} data={clientData} boards={orderAnimalPilotBoards(boards, newYorkDate(), data)} approvedBoardIds={approvedAnimalBoards(data, boards, reviews as AnimalBoardReview[]).map((board) => board.id!)} date={newYorkDate()} />;
}
