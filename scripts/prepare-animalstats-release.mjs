import fs from "node:fs";
import {spawnSync} from "node:child_process";
// Candidate boards are derived artifacts. Rebuild their admission after a source
// hold rather than publishing challenges that still depend on withdrawn facts.
for (const script of [["scripts/audit-animalstats-expansion-release.mjs","--write"],["scripts/audit-animalstats-board-mix.mjs"],["scripts/test-animalstats-marine-depth-review.mjs"]]) {
  const result=spawnSync(process.execPath,script,{stdio:"inherit"});
  if(result.status!==0)process.exit(result.status??1);
}

const mix=JSON.parse(fs.readFileSync("data/animalstats/research/board-mix-20261010.json","utf8"));
const gapPath="data/animalstats/research/expansion-gap-register.json",gap=JSON.parse(fs.readFileSync(gapPath,"utf8"));
gap.latestPlayableLabels=mix.playableLabels;gap.latestValidatedBoards=mix.defaultBoards;gap.catalogAnimalsLiving=mix.livingCatalogAnimals;gap.livingRoundAnimals=mix.livingRoundAnimals;
for(const row of gap.remainingGaps??[])if(row.area==="Marine invertebrates"&&!String(row.progress).includes("Marine-mammal habitat depths held"))row.progress+=" Marine-mammal habitat depths held pending water-column versus bathymetry interpretation; vetted fish and invertebrate depth records remain separate.";
fs.writeFileSync(gapPath,JSON.stringify(gap,null,2)+"\n");
