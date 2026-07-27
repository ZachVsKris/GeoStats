# GeoStats v14.3.1 Validation

## Automated checks

Run:

```bash
npm run test-v14-3-1
```

For the broader regression suite:

```bash
npm run test-v14-3
npm run test-importers
npm test
```

## Content acceptance checks

- `CATEGORY_CONTENT_SOURCE_REVIEW_V14_3_1.csv` contains 726 unique source/code decisions.
- It contains 243 approvals and 483 exclusions.
- The three flagged ILOSTAT categories are excluded.
- Every newly approved title is immediately interpretable without opening a definition.
- The 17 renamed categories display their revised player titles after migration.

## Player-link acceptance checks

- The player panel has one link labeled “View exact official data.”
- The panel never renders API/query/download links.
- Raw JSON, CSV, ZIP, XLSX, XML, API-host, and download-path URLs fail the URL-policy tests.
- World Bank categories point to `data.worldbank.org/indicator/[CODE]`.
- Categories lacking a source-specific exact page remain disabled.
- The weekly/manual GitHub workflow writes JSON and Markdown link-audit reports.

## Database acceptance checks

Run `VERIFY_V14_3_1.sql` and confirm:

- no unsafe or unreviewed category is playable
- content and link overview views load
- the three flagged categories are excluded
- World Bank links are readable indicator pages
- source-integrity and semantic-conflict views still load

## Manual browser checks

1. Complete a Daily game and open Data & Source for several World Bank categories.
2. Confirm the link opens a normal World Bank indicator webpage in a new tab.
3. Confirm no click shows raw JSON or starts a file download.
4. Confirm the global ranking remains searchable.
5. Confirm a category without an exact player link cannot appear on a newly generated Daily.
