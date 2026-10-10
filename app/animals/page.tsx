import { publishedAnimalTraitIds } from "../../lib/animalstatsCoverage";
import { animalPreviewEnabled } from "../../lib/animalstatsPreview";
import { notFound } from "next/navigation";
import AnimalStatsGame from "../../components/AnimalStatsGame";
import { packAnimalBoards } from "../../lib/animalstatsBoardTransport";
import { animalDataset as dataset } from "../../lib/animalstatsCatalog";
import { animalPhotos as realPhotos } from "../../lib/animalstatsCatalog";
import reviews from "../../data/animalstats/reviews.json";
import { approvedAnimalBoards, type AnimalBoardReview } from "../../lib/animalstatsReview";
import { animalCandidates as candidates } from "../../lib/animalstatsCatalog";
import { createAnimalBoardValidator, type AnimalDataset, type BoardCandidate } from "../../lib/animalstats";
import { orderAnimalPilotBoards } from "../../lib/animalstatsDaily";
import { animalBoardComposition } from "../../lib/animalstatsComposition";
import { newYorkDate } from "../../lib/time";

export const metadata = { title: "AnimalStats · The animal fair", description: "Match familiar animals to surprising facts. Pick your prize winners, then explore the sourced rankings.", robots: { index: false, follow: false }, alternates: { canonical: "/animals" } };
export const dynamic = "force-dynamic";

// These imports are immutable source snapshots. Validate once per worker, not once per visitor.
let catalog: { data: AnimalDataset; boards: BoardCandidate[]; clientData: AnimalDataset } | undefined;
function getCatalog() {
  if (catalog) return catalog;
  const data = dataset as AnimalDataset;
  const validate = createAnimalBoardValidator(data);
  const published = publishedAnimalTraitIds(data);
  const excluded = new Set(["adult_shoulder_height", "adult_shoulder_height__low", ...data.traits.filter(t => !published.has(t.id)).map(t => t.id)]);
  const boards = (candidates.boards as BoardCandidate[]).filter((board) => !board.traitIds.some(id => excluded.has(id)) && validate(board).valid);
  const pairedTraits = data.traits.filter((trait) => trait.prototypeCategory && !excluded.has(trait.id));
  const pairedIds = new Set(pairedTraits.map((trait) => trait.id));
  // The game needs numbers, not thousands of repeated citation paragraphs.
  // Complete observations are fetched when someone opens Data & Source.
  const clientData = { ...data, photos: realPhotos.filter(photo => photo.approved && photo.assetUrl.startsWith("/animalstats/") && (!photo.assetUrl.endsWith(".svg") || photo.assetUrl.startsWith("/animalstats/extinct/"))), traits: pairedTraits, values: data.values.filter((row) => pairedIds.has(row.traitId)).map(row => ({
    animalId: row.animalId, traitId: row.traitId, valueNumeric: row.valueNumeric,
    unit: row.unit, sourceId: row.sourceId, confidence: row.confidence,
    observationType: row.observationType, sex: row.sex, lifeStage: row.lifeStage,
    valueMin: row.valueMin, valueMax: row.valueMax, notes: "", measurementBasis: "",
  })) };
  catalog = { data, boards, clientData };
  return catalog;
}

export default async function AnimalStatsPage({ searchParams }: { searchParams: Promise<{ board?: string; mode?: string }> }) {
  const requested = await searchParams;
  // Read at request time so promoting a preview build cannot expose the pilot.
  if (!animalPreviewEnabled()) notFound();
  const { data, boards, clientData } = getCatalog();
  const defaultBoards = boards.filter(board => animalBoardComposition(data, board).eligible);
  // Existing challenge links remain exact; stricter composition governs ordinary play.
  const shared = requested.board ? boards.find(board => board.id === requested.board) : undefined;
  const releaseBoards = shared && !defaultBoards.includes(shared) ? [...defaultBoards, shared] : defaultBoards;
  if (!boards.length) notFound();
  return <AnimalStatsGame initialMode={requested.mode === "normal" || requested.mode === "expert" ? requested.mode : "easy"} initialBoardId={shared?.id} unavailableBoard={Boolean(requested.board && !shared)} data={clientData} boardCatalog={packAnimalBoards(orderAnimalPilotBoards(releaseBoards, newYorkDate(), data))} approvedBoardIds={approvedAnimalBoards(data, boards, reviews as AnimalBoardReview[]).map((board) => board.id!)} date={newYorkDate()} />;
}
