import type { NextConfig } from "next";
const animalSnapshots = ["pilot", "photos", "existing-coverage", "tetrapod-spatial", "marine", "aquatic-eggs", "fish-records", "underrepresented", "insect-ladybirds", "extinct", "candidates", "group-boards", "group-boards-2"].map(name => `./data/animalstats/${name}.json`);
const config: NextConfig = {
  outputFileTracingIncludes: {
    "/animals": animalSnapshots,
    "/animals/review": animalSnapshots,
    "/api/animals/*": animalSnapshots,
  },
};
export default config;
