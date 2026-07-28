# Installing the GitHub Actions workflows

The working workflow files are already included at:

- `.github/workflows/repair-v14-expansion.yml`
- `.github/workflows/main.yml`

GitHub only recognizes workflows in `.github/workflows/` on the repository's default branch.

## Important for macOS uploads

Finder hides folders whose names begin with a period. Before dragging the extracted repository into GitHub, press **Command + Shift + .** so the `.github` folder is visible and included.

After the commit reaches the default branch, refresh **GitHub → Actions**. You should see:

- **Repair and expand v14 imports**
- **Import all source data**

## Visible backup copies

If `.github` was omitted during upload, identical visible copies are in `GITHUB_ACTIONS/workflows/`.

In GitHub:

1. Choose **Add file → Create new file**.
2. Enter `.github/workflows/repair-v14-expansion.yml` as the filename.
3. Paste the contents of `GITHUB_ACTIONS/workflows/repair-v14-expansion.yml`.
4. Commit to the default branch.

Repeat for `.github/workflows/main.yml` using `GITHUB_ACTIONS/workflows/import-all-source-data.yml` only if the existing **Import all source data** workflow also needs replacement.
