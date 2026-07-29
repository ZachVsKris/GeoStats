# GeoStats

GeoStats is a daily geography strategy game built with Next.js and Supabase. Players assign countries to official statistical measures, using each country only once, to maximize their score.

Current release: **v15.7.0 clean integrated rebuild**.

Start with [START_HERE.md](START_HERE.md). The release-specific database files are:

- `RUN_THIS_IN_SUPABASE_FOR_V15_7.sql`
- `VERIFY_V15_7.sql`
- `ROLLBACK_V15_7.sql`
- `MANUAL_CATEGORY_REVIEW_V15_7.sql`

## Core game modes

- **Scout Daily:** 5 countries, 4 categories
- **Adventurer Daily:** 8 countries, 6 categories
- **Expert Daily:** 10 countries, 8 categories
- **Seeded:** repeatable unranked boards using the same approved category catalog

## v15.7 catalog policy

There is one approved gameplay catalog. A category that passes editorial and hard integrity review is eligible for Daily and Seeded play. There is no Random-only quality tier.

Categories outside play are classified as pending/quarantined, duplicate, rejected, or retired. Board-generation diversity is controlled through pairing and frequency rules rather than a lower-quality category pool.
