# GeoStats v15.6.1

## Corrected

- Seeded challenge routes now exist for all three difficulties and explicitly use Random mode
- Legacy Random route aliases remain usable
- Application rules version now matches the v15.6 database target (`12.2`)
- Category-cache keys were advanced to avoid serving stale titles
- Desktop category descriptions no longer use ellipsis/clamp behavior

## Player copy and catalog decisions

- `EN.URB.LCTY` → **Largest city by population**
- Preferred land-area category → **Largest land area**
- `EN.GHG.ALL.MT.CE.AR5` → **Most greenhouse gas emissions**
- Other total/per-person GHG variants are displaced by the preferred absolute-total concept
- Travel-services indicators enter quarantine until each exact measure is identified
- `EN.ATM.PM25.MC.M3` → **Highest fine-particle air pollution**
- FAOSTAT Fruit Primary production → **Most fruit produced**

Original source wording is preserved in category metadata and remains available for details/methodology work.

## Deliberately deferred

- New source imports
- Automated vetting of expansion candidates
- Full manual review of every approved category
