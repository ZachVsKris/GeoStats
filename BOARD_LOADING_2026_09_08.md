# Board loading improvements

September 8, 2026

- Live saved Daily API baseline: HTTP 200, Server-Timing daily;dur=39, response 78,567 characters. This measures server work, not a friend's total page load.
- Audited 354-category snapshot reconstruction: JSON 5,241,172 bytes; gzip represented as base64 786,528 bytes (85% smaller). This is a reconstruction from the audited source rows, not a measurement of a live authenticated Random request.
- The old full-snapshot cache exceeded Next's 2 MiB entry limit for this reconstructed data. Store the same JSON losslessly compressed, then decompress before canonicalization/generation. Retain catalog/data versions and invalidation tag.
- Scout/Adventurer mode links reuse a complete already-loaded Daily snapshot; normal navigation remains the fallback when unavailable. Expert retains its server-checked account entry.
- Memoize initial Daily deserialization instead of repeating it on each render.
- Fetch stored Daily rows and the approved catalog concurrently on cache fill.
- Reject late score-restoration responses belonging to a previously selected mode.

No generator, category-selection, feasibility, tie, diversity, Top-20, scoring, source-value, or Daily-publication rules changed. No existing board or score rewritten.

Checks: bounded cache storage, lossless reconstruction, catalog revision invalidation, TypeScript, current release static checks, production build. Warm Random startup should benefit; the first cache fill and actual solver time still exist. No numerical end-to-end speedup claimed without a before/after authenticated Random measurement.
