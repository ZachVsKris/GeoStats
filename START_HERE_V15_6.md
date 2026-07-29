# Install GeoStats v15.6

1. Do not delete the GitHub repository. Create a backup branch.
2. Upload the contents of `GeoStats-v15.6-update.zip` to the repository root, replacing matching files.
3. Upload hidden workflow files separately if GitHub omits `.github`.
4. Wait for the newest Verify GeoStats v15 action and Vercel deployment to pass.
5. Run `RUN_THIS_IN_SUPABASE_FOR_V15_6.sql`.
6. Run the catalog review workflow, then the Pew, Smithsonian, USGS and physical-summary imports in that order.
7. Review the generated CSV reports before promoting new categories.
