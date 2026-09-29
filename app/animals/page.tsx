import { notFound } from "next/navigation";
import AnimalStatsGame from "../../components/AnimalStatsGame";
import dataset from "../../data/animalstats/pilot.json";
import candidates from "../../data/animalstats/candidates.json";
import { validateAnimalBoard, type AnimalDataset, type BoardCandidate } from "../../lib/animalstats";
import { orderAnimalPilotBoards } from "../../lib/animalstatsDaily";
import { newYorkDate } from "../../lib/time";

export const metadata = { title: "AnimalStats private prototype", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AnimalStatsPage() {
  // Read at request time so promoting a preview build cannot expose the pilot.
  if (Reflect.get(process.env, "ANIMALSTATS_PREVIEW_ENABLED") !== "true") notFound();
  const data = dataset as AnimalDataset;
  const boards = (candidates.boards as BoardCandidate[]).filter((board) => validateAnimalBoard(data, board).valid);
  if (!boards.length) notFound();
  return <AnimalStatsGame data={data} boards={orderAnimalPilotBoards(boards, newYorkDate())} />;
}
