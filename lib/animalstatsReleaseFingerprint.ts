import { createHash } from "node:crypto";
import type { AnimalDataset, BoardCandidate } from "./animalstats";
// JSON loaders can reorder object properties. Record and board array order is
// significant; object-key order must not invalidate an otherwise exact seal.
function canonicalJson(value: unknown) {
  return JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
}
export function animalReleaseFingerprint(data: AnimalDataset, boards: BoardCandidate[]) {
  return {
    dataSha256: createHash("sha256").update(canonicalJson(data)).digest("hex"),
    boardsSha256: createHash("sha256").update(canonicalJson(boards)).digest("hex"),
  };
}
