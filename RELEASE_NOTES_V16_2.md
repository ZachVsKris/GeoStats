# GeoStats v16.2 release notes

## Release goal

v16.2 is a catalog-recovery and Daily-reliability release. It focuses on trustworthy category promotion, precise blocker reporting, source-specific auditing, and a Daily generator that constructs the three modes with cross-mode constraints in scope.

## One approved gameplay catalog

Daily and Random now use exactly the same catalog state:

- `enabled = eligible_daily`
- no “Random only” status
- no lower-quality Random tier

The generator controls repetition, recent-use cooldowns, category-family diversity, and cross-mode overlap. Category quality does not vary by mode.

## Conservative automatic promotion

Every category receives a v16.2 promotion assessment with one outcome:

- playable
- automatic promotion candidate
- manual review
- rewrite required
- data repair required
- duplicate
- excluded

Automatic promotion requires all of the following:

- objective official-source measure;
- semantic audit pass;
- comprehensive or top-end-complete ranking coverage;
- feasible distinct top values;
- no substantive official-source mismatch;
- source-specific quality floor;
- sufficient comparable-country coverage;
- current enough data;
- safe official player source;
- clear player title, description, and unit;
- no political/self-report, confusing, esoteric, composite, duplicate, or prohibited agriculture flags.

The installer first produces a dry-run assessment only. Automatic promotions are applied later by the workflow finalizer, after source recovery and independent audits succeed. The release does not bulk-approve categories merely because they are pending or were previously approved.

## Actionable blocker classification

The Workbench and Admin dashboard now distinguish:

- substantive data failure;
- copy or semantic rewrite;
- ranking-completeness failure;
- source-specific quality warning;
- editorial content review;
- duplicate;
- deliberate editorial exclusion;
- manual editorial review.

Each nonplayable category receives a primary blocker rather than an undifferentiated warning list.

## World Bank catalog recovery

A new recovery script refreshes legacy World Bank categories in place:

- current official series title and unit;
- exact source metadata and query identity;
- recent observations and common-year quality;
- official-source validation state reset before independent audit;
- preservation of existing category IDs and editorial history.

Observation replacement is transactional per category so an interrupted write cannot leave a category with a partially replaced snapshot.

## Source recovery and auditing

The v16.2 workflow refreshes and audits the main active catalogs, including World Bank, FAOSTAT, WHO, UN Comtrade, UNHCR, Natural Earth, Pew, FAOSTAT Food Balances, Smithsonian volcanoes, and USGS earthquakes.

Source-specific quality floors prevent a generic score from unnecessarily blocking reproducible Natural Earth or Pew categories, while substantive value, ranking, year, unit, or dimension failures remain hard blockers.

## Daily generator

The generator now includes:

- larger diversified candidate pools;
- compatibility-indexed pair search;
- cross-mode category and semantic-family filtering;
- country-overlap filtering before trio validation;
- a reserved joint-construction window;
- guided Scout/Adventurer/Expert construction with backtracking;
- bounded per-branch search so one failed branch cannot consume the full request;
- fresh run nonces so new attempts do not repeat the same exact search;
- richer diagnostics for compatible pairs, indexed checks, joint attempts, backtracks, elapsed time, and final conflicts.

The admin request is limited to one attempt and approximately one minute of generator work. Scheduled generation has a longer search budget.

## Admin and Workbench

The UI now includes:

- v16.2 outcome filtering;
- primary blocker and blocker-class display;
- manual-review, rewrite, and data-repair counts;
- elapsed generation time;
- detailed failure-stage diagnostics;
- explicit language that Daily and Random share one catalog.

## Copy corrections carried forward

The release preserves and expands the previously identified clarity rules, including explicit distinctions among totals, shares, rates, per-person measures, residence, and origin. Known corrections include protected land, arable-land total versus share, broadband subscriptions per 100 people, secure Internet servers per million people, forest area, spices, poultry meat, statelessness, and Food Balance estimated-consumption wording.

## Audit artifacts

The recovery workflow exports:

- a complete pre-promotion category audit;
- a conservative promotion dry run created before statuses change;
- a complete final category audit and applied-decision report;
- source and blocker summaries for both phases;
- catalog-consistency assertions confirming no Daily/Random split.

## Validation

Repository static checks, generator regressions, importer fixtures, Python compilation, changed TypeScript/TSX syntax transpilation, and workflow YAML parsing are included. The GitHub verification workflow installs the application dependencies and runs the full TypeScript check, production build, source-policy tests, real Natural Earth test, and Playwright responsive tests.
