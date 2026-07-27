# GeoStats v14.3 Release Notes

## World Bank warehouse repair

The prior browser importer selected the latest observation separately for each country and then labeled the most common year as the category's common year. That could create a mixed-year stored snapshot while the audit correctly reconstructed a single official year, producing large missing-country, ranking, and checksum failures.

v14.3 adds `fetchWorldBankImportSnapshot()`. It selects one official common year using the same coverage/freshness scoring rule as the Python pipeline and stores only that year's observations. Reimporting World Bank categories is required to repair older warehouse rows.

## More useful source-audit output

Audit results now identify separate failure types:

- source identity
- metadata
- coverage
- values
- rankings
- checksum
- source access / unable to verify

The workflow saves JSON and Markdown artifacts, continues across source-level failures, lists activation blockers, and defaults enforcement activation to off.

Unit validation now compares semantic unit signatures rather than failing solely because player-facing formatting differs from the provider's exact unit text. Ranking validation respects the category's stored `high` or `low` gameplay direction while independently checking the official values.

## Semantic variety

Every category receives a `semantic_family` and `semantic_topic`. Board selection rejects:

- two categories in the same semantic family,
- categories above the title/description similarity threshold,
- existing similarity-group conflicts.

Explicit same-board exclusions include:

- employment-to-population, unemployment, and labor-force participation
- refugees originating and asylum applications by origin
- refugee/asylum destination measures
- multiple crop-yield categories
- multiple crop-production categories
- multiple harvested-area categories

The Admin dashboard and SQL views expose same-family playable pairs for review. Admin also calculates cross-family title/description similarity warnings using the same threshold enforced by the generator.

## Permanent verified-only gate

The Supabase governance function now requires `validation_status = verified` before any category can be enabled or become Daily-eligible. The feature-flag activation step remains as a warehouse milestone and safety check, but pending imports cannot enter gameplay even before that flag is turned on.

## Global top-30 winner rule

For every category, the highest-performing country among the countries shown on the board must be globally ranked #30 or better in the verified complete ranking. The rule is enforced during generation, stored-board validation, Daily repair, and score submission.

## Existing generation rules retained

- Scout: maximum 2 countries from one continent and 1 FAOSTAT category
- Adventurer: maximum 3 countries from one continent and 2 FAOSTAT categories
- Expert: maximum 3 countries from one continent and 2 FAOSTAT categories
- distinct category winners
- maximum one shared country between any two Daily modes
- no repeated category across the three Daily modes
- existing source, trade, agriculture, and category-diversity limits

## Version identifiers

- App: `14.3.0`
- Rules: `8.0`
- Dataset: `source-integrity-semantic-quality-v14-3`
