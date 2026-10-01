import type { Animal } from "./animalstats";
export type PairingBehavior = "mount" | "water" | "coil";
export type BirthMode = "live" | "egg" | "pouch";
export function animalLifeCycle(
  animal: Pick<Animal, "id" | "taxonomicGroup" | "scientificName">,
): { birth: BirthMode; pairing: PairingBehavior; sourceUrl: string } {
  const egg =
    animal.taxonomicGroup === "bird" ||
    animal.taxonomicGroup === "turtle" ||
    animal.taxonomicGroup === "crocodilian" ||
    animal.id === "python_molurus" ||
    animal.id === "ornithorhynchus_anatinus";
  return {
    birth: egg
      ? "egg"
      : animal.taxonomicGroup === "marsupial"
        ? "pouch"
        : "live",
    pairing:
      animal.taxonomicGroup === "marine-mammal" ||
      animal.id === "ornithorhynchus_anatinus"
        ? "water"
        : animal.taxonomicGroup === "snake"
          ? "coil"
          : "mount",
    sourceUrl: `https://animaldiversity.org/accounts/${animal.scientificName?.replaceAll(" ", "_") ?? animal.id}/`,
  };
}
