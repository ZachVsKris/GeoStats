# Install v13.0

This ZIP is an **overlay build** for the existing GeoStats repository. It contains every new or replaced file required for v13.0, while leaving all unrelated game files untouched.

1. Run `RUN_THIS_IN_SUPABASE_FIRST.sql` in Supabase SQL Editor.
2. Extract the ZIP locally.
3. Open the extracted `geostats-v13.0-unified-who` folder. On a Mac, press **Command + Shift + .** so the hidden `.github` folder is visible.
4. Upload everything inside it, including `.github`, to the root of the GitHub repository.
5. Choose **replace** when GitHub reports matching files.
6. Commit.
7. Wait for Vercel.
8. Run **Import WHO candidates** in GitHub Actions.

The repository should then contain:

```text
.github/workflows/import-faostat.yml
.github/workflows/import-who.yml
.github/workflows/main.yml
app/admin/AdminDashboard.tsx
app/api/admin/categories/review/route.ts
app/api/admin/dashboard/route.ts
scripts/data_pipeline/*.py
scripts/import-who.py
supabase/migrations/011_unified_importers_and_canonical_categories.sql
```

## After deployment

Running **Import WHO candidates** is the fastest first test. Running **Import all source data** refreshes both FAOSTAT and WHO in parallel. Existing FAOSTAT approvals and rejections are preserved by its importer; the new shared framework also preserves WHO editorial decisions across refreshes.
