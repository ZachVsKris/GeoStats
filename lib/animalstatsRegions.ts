/** Display ADW's published biogeographic labels without claiming native-only ranges. */
export const ANIMAL_REGION_LABELS: Record<string, string> = {
 nearctic: "North America", palearctic: "Europe & northern Asia", oriental: "South & southeast Asia",
 ethiopian: "Sub-Saharan Africa", neotropical: "Central & South America", australian: "Australia & nearby islands",
 antarctica: "Antarctic region", "oceanic islands": "Oceanic islands", "atlantic ocean": "Atlantic Ocean",
 "pacific ocean": "Pacific Ocean", "indian ocean": "Indian Ocean", "arctic ocean": "Arctic Ocean",
};
export const animalRegionLabel = (region: string) => ANIMAL_REGION_LABELS[region] ?? region;
