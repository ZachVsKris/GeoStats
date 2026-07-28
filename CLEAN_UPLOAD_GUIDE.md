# Clean upload and future updates

## Why the repository became cluttered

The previous release packages kept every old installer, release note, verification file, manifest, review CSV/JSON export, and duplicate visible copy of the GitHub workflows. GitHub only needs the active application, scripts, migrations, and `.github/workflows` directory.

This clean v15.2 working tree reduces the repository from approximately 363 files and 137 root files to approximately 222 files and 16 root files. Database migration history remains under `supabase/migrations`.

## Safest one-time clean replacement with GitHub Desktop

1. Make sure your current local repository is backed up.
2. Open the repository in GitHub Desktop.
3. Choose **Repository → Show in Finder**.
4. Delete everything in the repository folder except:
   - `.git`
   - `.env.local` or other local secret files
5. Copy the contents of the extracted v15.2 folder into the repository folder. `app`, `lib`, `scripts`, `supabase`, and `.github` must be at the repository root.
6. Return to GitHub Desktop. It will show additions, edits, and deletions.
7. Commit with a message such as `Clean GeoStats v15.2 catalog recovery` and push.

This is better than GitHub's browser upload because GitHub Desktop records deletions and uploads only the changed Git objects.

## Terminal alternative

From outside both folders:

```bash
rsync -a --delete \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='node_modules' \
  --exclude='.next' \
  /path/to/extracted-v15.2/ /path/to/local-Geohunter/

cd /path/to/local-Geohunter
git add -A
git commit -m "Clean GeoStats v15.2 catalog recovery"
git push origin main
```

## After GitHub and Vercel pass

Run `RUN_THIS_IN_SUPABASE_FOR_V15_2.sql` once in Supabase. Then test `/api/daily-trio/2026-07-28` and `/daily`.
