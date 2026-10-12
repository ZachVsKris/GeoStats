import { NextResponse } from "next/server";
import { animalPreviewEnabled } from "../../../../lib/animalstatsPreview";
import { getAnimalRelease } from "../../../../lib/animalstatsRelease";
import { packAnimalBoards } from "../../../../lib/animalstatsBoardTransport";
export async function GET() {
  if (!animalPreviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const release = getAnimalRelease();
  return NextResponse.json(packAnimalBoards(release.defaultBoards), { headers: { "Cache-Control": "private, max-age=300", "X-AnimalStats-Validation": release.validation } });
}
