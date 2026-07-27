# GeoStats v14.3: Source Repair and Better Daily Boards

This release fixes the World Bank warehouse snapshot problem exposed by the v14.2 audit and adds hard gameplay rules against repetitive categories and globally weak board winners.

## What changes

- World Bank imports now store one true common-year snapshot rather than mixing each country's latest available year.
- The source audit separates source-identity, metadata, coverage, value, ranking, and checksum failures.
- The database governance gate is permanently verified-only: pending, failed, and unverifiable categories cannot be enabled.
- Every category has a semantic family. A board cannot contain two categories from the same family or a highly similar pair.
- This blocks pairs such as employment-to-population with unemployment, and refugees originating with asylum applications by origin.
- Admin also reports cross-family title/description similarity warnings for editorial review.
- The winning country for every category on a board must be ranked **#30 or better globally** in that category.
- Existing continent, source, agriculture, and FAOSTAT limits remain in force.
- Stored Daily boards are revalidated. Legacy boards that violate the new rules are rejected and regenerated.

## Install in this order

### 1. Replace the whole GitHub repository

Upload the complete v14.3 folder, including the hidden `.github` directory. Confirm that GitHub contains:

- `.github/workflows/audit-source-integrity.yml`
- `supabase/migrations/023_semantic_board_quality.sql`
- `lib/categorySemantics.ts`
- `lib/worldBank.ts`

Do not upload only the patch files over an uncertain repository state.

### 2. Run the combined Supabase installer

In the Supabase SQL editor, run:

`RUN_THIS_IN_SUPABASE_FOR_V14_3.sql`

This preserves the v14.2 source-integrity schema and adds semantic-family fields, board-quality views, and the v14.3 activation function.

### 3. Deploy the v14.3 application code

The corrected World Bank importer is application code. It must be deployed before repairing the warehouse.

### 4. Reimport the curated World Bank categories

In GeoStats Admin, run the World Bank warehouse import again and allow it to finish. This step is necessary because older World Bank rows may contain a mixed-year snapshot. The new importer:

- retrieves all official 2022-current observations,
- chooses one common year using the warehouse quality rule,
- deletes the old category snapshot,
- stores only that common year's countries and values,
- records the official series name, unit, query, year, and coverage,
- leaves each category disabled and pending audit.

A successful import response reports both `year` (the stored common year) and `latestYear` (the newest year found at the source).

### 5. Run the source audit with enforcement OFF

Open GitHub Actions and run **Audit all source integrity** with:

- Source: `all` or the source being repaired
- Include non-playable: normally off
- Activate enforcement: **off**

The workflow now defaults activation to off and uploads a report artifact. Review failures by type rather than treating every metadata warning as a value error.

### 6. Inspect the results

Run `VERIFY_V14_3.sql` in Supabase and inspect the uploaded audit artifact.

Before activation, confirm:

- no enabled or Daily-eligible category is unverified,
- World Bank common years and coverage match the official snapshots,
- value and ranking mismatch counts are zero for verified categories,
- semantic families look sensible,
- the Admin board-quality conflict report is understood.

The conflict view lists playable categories that share a semantic family. That does not mean they are unusable; it means they cannot appear together on one board.

### 7. Activate fail-closed enforcement only with zero blockers

Rerun the audit with **Activate enforcement** on only after the report has no currently playable unverified categories. The activation function will refuse otherwise.

### 8. Regenerate today's Daily boards

Old boards containing same-family categories or a winner outside the global top 30 will fail current validation. Reloading/generating the Daily trio replaces invalid modes and removes scores tied to repaired boards.

## Important interpretation

The top-30 requirement applies to the **best country among the countries shown for each category**. That board winner must itself be ranked #30 or better in the complete verified global ranking. The global #1 country does not have to appear on every board.

## Local verification performed for this package

The repository includes and passes fixture, semantic-classification, importer, gameplay-invariant, repository-structure, and TypeScript-syntax tests. A full local Next production build could not be completed in the packaging environment because the package registry returned HTTP 503 while installing Next dependencies. Vercel remains the production build check.
