import type { AnimalDataset } from "./animalstats";
type PackedValue = [number, number, number, number, number, number, number, number, number, number | null, number | null];
export type AnimalDataTransport = Omit<AnimalDataset, "values"> & { valueEncoding: 1; valueLabels: string[]; values: PackedValue[] };

/** Preserve game observations exactly while avoiding repeated IDs and labels.
 * Full citation text remains in the independently fetched source view. */
export function packAnimalData(data: AnimalDataset): AnimalDataTransport {
  const animals = new Map(data.animals.map((a, i) => [a.id, i]));
  const traits = new Map(data.traits.map((t, i) => [t.id, i]));
  const labels: string[] = [];
  const indices = new Map<string, number>();
  const label = (value: string) => {
    if (!indices.has(value)) { indices.set(value, labels.length); labels.push(value); }
    return indices.get(value)!;
  };
  const values: PackedValue[] = data.values.map(v => [animals.get(v.animalId)!, traits.get(v.traitId)!, v.valueNumeric,
    label(v.unit), label(v.sourceId), label(v.confidence), label(v.observationType), label(v.sex), label(v.lifeStage),
    v.valueMin ?? null, v.valueMax ?? null]);
  return { ...data, values, valueEncoding: 1, valueLabels: labels };
}
export function unpackAnimalData(packed: AnimalDataTransport): AnimalDataset {
  const { valueEncoding: _encoding, valueLabels: labels, ...data } = packed;
  return { ...data, values: packed.values.map(([a, t, n, unit, source, confidence, observation, sex, stage, min, max]) => ({
    animalId: data.animals[a].id, traitId: data.traits[t].id, valueNumeric: n,
    unit: labels[unit], sourceId: labels[source], confidence: labels[confidence] as AnimalDataset["values"][number]["confidence"],
    observationType: labels[observation] as AnimalDataset["values"][number]["observationType"], sex: labels[sex], lifeStage: labels[stage],
    valueMin: min ?? undefined, valueMax: max ?? undefined, notes: "", measurementBasis: "",
  })) };
}
