# GeoStats v14.0.0

GeoStats is a strategy geography game built with Next.js and Supabase. It includes three trusted Daily difficulties, reproducible unranked random seeds, a database-driven category warehouse, board-relative all-time ratings, and GeoStats-owned player accounts.

## What v14 adds

- **Source & all data viewer:** every result can open the exact country-value snapshot used by GeoStats, with the comparison year, unit, indicator, source, methodology, download/API links, license, and retrieval information.
- **Clear subtitles:** each category has a plain-English explanation displayed beneath its title. The source-native technical definition remains available in the source panel.
- **Objective-only governance:** perception rankings, subjective judgments, and composite scores are blocked.
- **Three new player-quality gates:** verifiability, understandability, and fun.
- **Explicit candidate review queue:** newly discovered categories remain disabled until a reviewer approves them. Imports can therefore be broad without silently changing the playable game.
- **Large candidate expansion:** up to 500 additional World Bank WDI candidates per run, 55 UN Comtrade product-export candidates, and 24 reproducible Natural Earth geography candidates, in addition to the existing FAOSTAT, WHO, UNESCO UIS, ILOSTAT, UNHCR, EIA, Comtrade, and Natural Earth importers.
- **Reproducible GIS provenance:** derived Natural Earth categories store the exact input layer, release, scale, calculation method, and processing version.

GeoStats' data rule is simple: **a category must measure an objective country characteristic, be understandable to an ordinary player, and let the player inspect the exact values used.**

Start with [`START_HERE_V14.md`](START_HERE_V14.md).
