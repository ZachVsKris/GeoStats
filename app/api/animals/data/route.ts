import { NextResponse } from "next/server";
import { animalPreviewEnabled } from "../../../../lib/animalstatsPreview";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import catalog from "../../../../data/animalstats/pilot.json";
import candidates from "../../../../data/animalstats/candidates.json";

const playable = new Set(candidates.boards.flatMap(b => b.traitIds));
export async function GET(request: Request) {
  if (!animalPreviewEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  if (params.get("scope") === "catalog") {
    const traits = catalog.traits.filter(t => playable.has(t.id) && !t.id.startsWith("adult_shoulder_height"));
    const ids = new Set(traits.map(t => t.id));
    return NextResponse.json({ data: { ...catalog, photos: [], traits, values: catalog.values.filter(v => ids.has(v.traitId) && v.confidence === "approved" && v.observationType !== "imputed") }, origin: "release-snapshot" }, { headers: { "Cache-Control": "private, max-age=300" } });
  }
  const traitId = params.get("trait");
  const trait = catalog.traits.find(t => t.id === traitId);
  if (!trait || !playable.has(trait.id)) return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  const expected = catalog.values.filter(v => v.traitId === trait.id && v.confidence === "approved" && v.observationType !== "imputed");
  const snapshot = () => NextResponse.json({ trait, values: expected, coverage: expected.length, origin: "release-snapshot" }, { headers: { "Cache-Control": "private, max-age=60" } });
  const client = await createSupabaseServerClient();
  if (!client) return snapshot();
  const rows = [];
  for (let start = 0; start < 10000; start += 500) {
    const { data, error } = await client.from("animal_catalog_observations").select("payload").eq("trait_id", trait.id).eq("review_status", "approved").neq("observation_type", "imputed").order("animal_id").range(start, start + 499);
    if (error) return snapshot();
    rows.push(...data.map(r => r.payload));
    if (data.length < 500) break;
  }
  const knownAnimals = new Set(catalog.animals.map(a => a.id));
  const warehouse = new Map(rows.map(r => [r.animalId, r]));
  if (warehouse.size !== rows.length || rows.some(r => !knownAnimals.has(r.animalId) || r.traitId !== trait.id || r.measurementBasis !== trait.measurementBasis || r.unit !== trait.unit || r.confidence !== "approved" || !["observed", "compiled"].includes(r.observationType) || !Number.isFinite(r.valueNumeric) || r.valueNumeric <= 0 || r.sourceId !== trait.canonicalSourceId) || expected.some(v => {
    const row = warehouse.get(v.animalId);
    return !row || row.valueNumeric !== v.valueNumeric || row.sex !== v.sex || row.lifeStage !== v.lifeStage || row.valueMin !== v.valueMin || row.valueMax !== v.valueMax;
  })) return snapshot();
  return NextResponse.json({ trait, values: rows, coverage: rows.length, origin: "warehouse" }, { headers: { "Cache-Control": "private, max-age=60" } });
}
