# AnimalStats protected preview

Work remains on `feature/animalstats-prototype`. `/animals`, `/animals/review`, `/api/animals/results`, and `/cat` require the runtime preview flag or this branch's Vercel preview environment. Public GeoStats has not been promoted or changed.

## Current coverage

131 animals, 60 trait entries (including source-specific definitions and seven lower-wins variants), 2,199 sourced observations, 117 approved photographic icons, and 65 numerical board candidates. Scout has 41 candidates, Adventurer 18, and Expert six. Scout and Adventurer support themed, clustered and cross-animal boards; Expert currently has three bird and three cross-animal mammal boards. A valid Expert clustered pool is still missing. Invertebrates have sourced Field Guide entries but insufficient comparable measurements for complete boards.

Sources are pinned AnAge Build 15, AVONET v7, AmphiBIO v1/version 5, and the raw August 2015 Amniote life-history compilation. Rebuild with `build-animalstats-pilot.py`, `add-animalstats-birds.py`, `expand-animalstats.py`, `add-animalstats-amniote.py`, `generate-animalstats-boards.py`, then `audit-animalstats.py`. Downloaded source archives/workbooks are ignored; scripts pin their versions and checksums. The selected raw Amniote rows are retained in the repository.

Amniote observations use exact species rows without subspecies interpolation; distinct positive reports supply a median and source disagreement envelope, not a confidence interval. Unknown-origin longevity is excluded. AmphiBIO egg diameters are excluded because measurement definitions differ; frog snout-vent length is separate from salamander total length. AnAge quality/sample-size flags describe longevity only. Missing uncertainty remains explicitly unknown.

## Review and daily admission

The validator rejects incompatible sources, units, sex/life stages, origins, estimates, missing approved portraits, overlapping reported ranges, numerical gaps below 5%, redundant concepts, and repeated winners. Validation produces candidates, not editorial approval.

**Zero boards are currently approved for daily play.** `reviews.json` requires reviewer/date and source, uncertainty and playability evidence bound to the exact board and data. Daily shows an awaiting-review state until those reviews exist. Browser PASS labels are playtest feedback and cannot authorize a daily board. `/animals/review` exposes the holds and provenance.

## Experience and account storage

Small portraits stay visible. Click either an animal or trait first, drag into a trait, swap placements, and reset. Random play, result sharing, a searchable Field Guide and personal stats are integrated. CAT navigation introduces an atlas/habitat/underground visual identity; Things is a visual placeholder, not a playable game.

Device history records the first completion of a board per day. Signed-in future results use the separate `animal_game_results` table. The additive migration has been applied. Owner-only RLS permits authenticated reads; browser writes are denied. The server derives scores from canonical assignments and uses first-completion uniqueness. Existing guest history is not imported into an account. Countries scores remain separate.

Build with `ANIMALSTATS_PREVIEW_ENABLED=true npm run build`; verify with the same flag and `npx playwright test e2e/animalstats.spec.ts --project=chrome-desktop`. Account ownership and browser-write denial were checked in a rolled-back database transaction. A live signed-in browser session still needs validation.
