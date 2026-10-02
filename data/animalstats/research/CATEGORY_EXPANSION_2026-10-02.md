# AnimalStats broad category research

## Result of this pass

The editorial register now contains **112 distinct concepts across 21 subject areas**, each with two opposite labels: **224 proposed labels**. This combined register includes existing concepts, promising additions and evidence gaps. It is not 224 new playable prizes, and should not be added to the old playable count.

Initial interest judgment: **87 intuitive concepts and 25 specialist concepts**. This is a manual editorial judgment, not evidence that all questions will be fun. Board selection must independently require at least half intuitive traits, preferably more, and avoid closely related trait repetitions.

| Evidence position | Concepts | Interpretation |
|---|---:|---|
| Downloaded source; endpoint audit needed | 39 | A relevant table is available, but comparable observations and sufficient animals still need approval |
| Evidence lead | 42 | A research paper, database or case-study collection was located; not necessarily a usable numerical table |
| Limited study or context-only source | 13 | Evidence is narrow, categorical or does not measure the requested endpoint |
| No comparable source yet | 18 | Retained as research questions, not claimed as sourced categories |

**New game approvals in this pass: zero.** This pass expands acquisition and manual review, as requested. Live boards have not been changed by this research package.

## Downloaded and inspected additions

Seven table snapshots from six research works are preserved locally, with checksums and a private raw-record export:

| Source | What was acquired | Useful direction | Limitation |
|---|---|---|---|
| MacLean shared cognition tasks | 345 A-not-B and 439 cylinder subject records; 27 and 32 source species labels respectively | Performance on the same puzzle; potentially learning trials | Specific task performance, not a smartest/dumbest scale; subject/population/context differences retained |
| Comparative diving | 1,792 source rows; 1,248 contain maximum-duration values | Longest/shortest observed dive; multiple animal groups | 286 distinct source labels include sex-specific names and spelling variants; this is not a canonical species count |
| Mammalian olfaction | Workbook with odor detection and discrimination tables | Odor-specific sensitivity and shared discrimination tests | No generic best smell ranking; receptor gene counts are not performance measurements |
| Observed mammalian diets | 1,437 rows and four food-class presence fields | More mammal food-variety facts | Broad food classes, not number of prey species; mixed evidence methods need review |
| Hibernation phenotypes | Species/context matrix and notes | Context and filtering | `MaxTorporLength` contains classes, not durations; excluded from numerical duration prizes |
| Ruf & Geiser torpor review | Numerical paper table, 238 raw rows including headings | Longest/shortest torpor bout | Preserve units, headings and footnotes; a bout is not the entire hibernation season |

Sources: [cognition](https://figshare.com/articles/dataset/5579335), [diving](https://doi.org/10.5061/dryad.tqjq2bvv9), [olfaction](https://doi.org/10.5061/dryad.73n5tb33v), [mammalian diets](https://doi.org/10.5061/dryad.83bk3j9vk), [phenotypes](https://figshare.com/articles/dataset/23310731), [torpor review](https://doi.org/10.1111/brv.12137).

## Broadest acquisition opportunities

1. **Movement:** the Cloyed & Dell compilation reports maximum/routine speed, acceleration and turning measurements. The data paper covers 884 organisms, so non-animals must be removed. Its downloadable archive was blocked in this environment. The existing travel-speed archive remains available; sustained travel speed is a separate endpoint from sprint speed.
2. **Construction:** the global bird nest compilation includes dimensions, placement height and building time. Keep it as a source lead until the actual table and endpoint coverage are available. Add it to mixed boards rather than generating more bird-only boards.
3. **Mammal anatomy and social life:** bovid horn measurements and cervid antler data offer distinct, visible traits. Sex, season and curved vs straight lengths matter. Published group-size observations need study context; ordinal group-size codes are not measured counts.
4. **Senses and sound:** Animal Audiograms exposes experiment context and threshold measurements; its API request failed here. Calibrated calls and visual-acuity papers offer leads, but air/water sound references and measured/anatomical acuity cannot be pooled casually.
5. **Development and parenting:** keep direct incubation, maturity, weaning, litter/clutch and development times. Care-type matrices cannot produce longest-care rankings; fitted growth coefficients cannot be renamed raw growth speeds.
6. **History:** Catalogue of Life, fossil occurrences, archaeological domestication evidence and IUCN translocation case studies are useful avenues. Verify original descriptions; preserve fossil/date ranges, taxonomic rank and geographic scope.

Source leads are recorded in `expanded-category-summary.json` and alongside every proposal in `expanded-category-register.csv`.

## Important holds

- Generic intelligence, strength and agility have no defensible common scalar in this research pass.
- Lifetime movement requires lifetime observations; multiplying daily movement by lifespan is an estimate and is excluded.
- Experimental food/water restriction duration is not demonstrated maximum survival without food or drinking.
- Local population counts/densities and the Living Planet Index are not worldwide animal totals.
- Healing studies with uncertain or indistinguishable species differences cannot create confident ordered answers.
- Teeth, legs, ears, eyes, fur, colony size, carrying/lifting, regeneration and seasonal behavior remain promising questions, but several still lack sufficiently broad comparable tables.
- A reputable publisher does not automatically make every table field suitable for this game. Imputed or modeled biological values remain excluded.

## Manual audit and balance

For each concept, review primary measurements, common endpoint, sample size, uncertainty, missingness, taxonomic identity, life stage, sex, wild/captive context, study geography and enough recognizable animals to form worthwhile boards. Opposites must use exactly the same approved observations with reversed direction. Missing or inapplicable values must never become zero.

Track coverage by mammals, birds, reptiles, amphibians, fish, insects, arachnids and other invertebrates. Raw source size must not determine board frequency. A large reptile table cannot take over the game, and large bird-only sources should supplement mixed boards. Population or range data derived from maps must retain their explicit definition and version.

Do not promote a downloaded table until this audit is complete. The CSV has a `manual_decision` column for keep, revise or reject; all decisions currently remain pending.

## Reproduce the package

```sh
python scripts/fetch-animalstats-behavior-sources.py
python scripts/audit-animalstats-behavior-sources.py
python scripts/build-animalstats-category-register.py
```

The fetch manifest records successful snapshots and blocked requests separately. `--cached-only` rebuilds the manifest from the existing acquired snapshots without retrying blocked publisher routes. Full third-party tables and private raw exports are ignored by git; scripts, checksums, source links and the editorial register are preserved.
