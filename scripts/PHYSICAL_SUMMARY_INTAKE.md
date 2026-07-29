# Physical summary intake

`import-physical-summaries.py` accepts vetted country-level CSV summaries for sources whose global raw files are too large for an ordinary application build.

Supported source values:

- `worldcover`
- `hydrosheds`
- `elevation`

The CSV must follow `physical-summary-schema.csv`. Every production file must document:

- one fixed source release
- one fixed country-boundary set
- the exact unit
- the reference year
- the complete derivation method
- official source and methodology URLs

The included CSV row is a schema example only and must not be imported.

Examples:

```bash
python scripts/import-physical-summaries.py \
  --source worldcover \
  --input /path/to/worldcover-country-summary.csv \
  --dry-run
```

New categories always enter v15.5 review quarantine. They are not made playable until source integrity, comprehension, tie-density and duplicate review all pass.
