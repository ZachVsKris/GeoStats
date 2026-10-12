import { packAnimalData } from "../../lib/animalstatsDataTransport";
import { getAnimalRelease } from "../../lib/animalstatsRelease";
import { animalPreviewEnabled } from "../../lib/animalstatsPreview";
import { notFound } from "next/navigation";
import AnimalStatsGame from "../../components/AnimalStatsGame";
import { openingAnimalBoards, packAnimalBoards } from "../../lib/animalstatsBoardTransport";
import reviews from "../../data/animalstats/reviews.json";
import { approvedAnimalBoards, type AnimalBoardReview } from "../../lib/animalstatsReview";
import { orderAnimalPilotBoards } from "../../lib/animalstatsDaily";
import { newYorkDate } from "../../lib/time";

export const metadata = { title: "AnimalStats · The animal fair", description: "Match familiar animals to surprising facts. Pick your prize winners, then explore the sourced rankings.", robots: { index: false, follow: false }, alternates: { canonical: "/animals" } };
export const dynamic = "force-dynamic";

export default async function AnimalStatsPage({ searchParams }: { searchParams: Promise<{ board?: string; mode?: string }> }) {
  const requested = await searchParams;
  // Read at request time so promoting a preview build cannot expose the pilot.
  if (!animalPreviewEnabled()) notFound();
  const { data, boards, defaultBoards, clientData } = getAnimalRelease();
  // Existing challenge links remain exact; stricter composition governs ordinary play.
  const shared = requested.board ? boards.find(board => board.id === requested.board) : undefined;
  const releaseBoards = shared && !defaultBoards.includes(shared) ? [...defaultBoards, shared] : defaultBoards;
  if (!boards.length) notFound();
  const approvedBoardIds = approvedAnimalBoards(data, boards, reviews as AnimalBoardReview[]).map(board => board.id!);
  const ordered = orderAnimalPilotBoards(releaseBoards, newYorkDate(), data);
  return <AnimalStatsGame initialMode={requested.mode === "normal" || requested.mode === "expert" ? requested.mode : "easy"} initialBoardId={shared?.id} unavailableBoard={Boolean(requested.board && !shared)} data={packAnimalData(clientData)} boardCatalog={packAnimalBoards(openingAnimalBoards(ordered, approvedBoardIds, shared?.id))} approvedBoardIds={approvedBoardIds} date={newYorkDate()} />;
}
