# AnimalStats board audit

Audit: 2026-10-05T07:09:42.419Z

All 5,932 stored boards pass the existing structural validator. This checks source identity, comparable units and measurement basis, taxon eligibility, sex/life stage, adjacent rank separation, reported bound overlap, distinct winners, and attainable perfect scores. It is not a fresh replication of every published biological claim.

## Default play

- 5,324 boards, 103 illustrated animals and 96 distinct prize labels meet the stronger composition rules.
- Scout: at least 1 common animal type and 3 intuitive prizes out of 4.
- Adventurer: at least 2 common animal types and 3 intuitive prizes out of 4.
- Expert: at least 2 common animal types and 4 intuitive prizes out of 6.
- 608 older boards are kept only for exact shared challenges. Four specialist prize labels leave ordinary rotation: longest/shortest egg and most/least REM sleep.
- Common-animal membership is an editorial judgment. Names remain exact species; the list includes broadly recognized types such as crocodiles, sharks, ducks, goats and penguins.

## Rotation checks

| Difficulty | Simulated rounds | Animals reached / available | Prize labels reached / available | Immediate repeated lineups |
| --- | ---: | ---: | ---: | ---: |
| Scout | 3000 | 100 / 100 | 96 / 96 | 0 |
| Adventurer | 3000 | 97 / 97 | 81 / 81 | 0 |
| Expert | 3000 | 43 / 43 | 29 / 29 | 0 |

The selector balances subject groups first, prize names second, and animals third. The previous 12 rounds reduce repeat probabilities. Opposite directions can rotate, but the same metric and its opposite never share a board. Source coverage still limits the feasible combinations; rotation cannot make all facts equally frequent. Opening boards use the same balancing rather than a small preferred subset. All 270 tested openings across 90 dates pass the common-animal and intuitive-prize rule.

## Source reconciliation

- 2,538 AnAge-backed observation rows match the pinned original AnAge Build 15 file, including exact taxa, wild/captive longevity origins and calculated mass-specific metabolism. No mismatches or unmapped rows.
- Dataset provenance, counterpart values, and approved artwork checks pass.
- 2,726 distinct observations used by default boards lack full reported uncertainty bounds. They remain explicitly unreported; numeric separation is not proof that real animal variation cannot overlap.
- Other source families retain their prior extraction audits. This audit does not newly compare every value in those families with its original paper.

## Remaining coverage gaps

- Expert has only mammal boards. Scout and Adventurer have mammals, birds and mixed-animal boards.
- No insects currently appear in playable rounds. Most amphibians also lack playable rounds.
- 176 species have catalog entries; only 103 appear in the stricter default pool. Catalog membership is not a claim of playable coverage.
- Scarlet macaw and boa constrictor have illustrated legacy boards but no board meeting the stronger default rule.
- Other well-known animals remain outside rounds because of missing precise artwork or insufficient compatible, intuitive comparisons. The JSON report lists every animal and its playable-board and ranking coverage.
- General weight, pregnancy, newborn weight and lifespan still appear frequently because they support many valid combinations. A broader audited data pool is needed to reduce this dependency further.
