import { NextResponse } from "next/server";
import { animalPreviewEnabled } from "../../../../lib/animalstatsPreview";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import catalog from "../../../../data/animalstats/pilot.json";
import candidates from "../../../../data/animalstats/candidates.json";

const playable = new Set(candidates.boards.flatMap(b => b.traitIds));
export async function GET(request: Request) {
  if (!animalPreviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const traitId = new URL(request.url).searchParams.get("trait");
  const trait = catalog.traits.find(t => t.id === traitId);
  if (!trait || !playable.has(trait.id)) return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: "Animal database is unavailable" }, { status: 503 });
  const rows = [];
  for (let start = 0; start < 10000; start += 500) {
    const { data, error } = await client.from("animal_catalog_observations").select("payload").eq("trait_id", trait.id).eq("review_status", "approved").neq("observation_type", "imputed").order("animal_id").range(start, start + 499);
    if (error) return NextResponse.json({ error: "The full animal ranking could not be loaded" }, { status: 503 });
    rows.push(...data.map(r => r.payload));
    if (data.length < 500) break;
  }
  const expected = catalog.values.filter(v => v.traitId === trait.id && v.confidence === "approved" && v.observationType !== "imputed");
  const knownAnimals = new Set(catalog.animals.map(a => a.id));
  if (rows.length < expected.length || rows.some(r => !knownAnimals.has(r.animalId) || r.traitId !== trait.id || r.measurementBasis !== trait.measurementBasis || !Number.isFinite(r.valueNumeric) || r.valueNumeric <= 0 || r.sourceId !== trait.canonicalSourceId)) return NextResponse.json({ error: "Database coverage or measurement context could not be verified" }, { status: 503 });
  return NextResponse.json({ trait, values: rows, coverage: rows.length, origin: "warehouse" }, { headers: { "Cache-Control": "private, max-age=60" } });
}
