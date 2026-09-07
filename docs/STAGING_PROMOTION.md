# RamaVerse isolated staging promotion gate

This stage prepares a **disabled** review-staging promotion mechanism for a future verified RamaVerse authoritative RC.

It does not authorize or perform real RC extraction, real promotion, canonical publication, Mobile/VC14 mutation, or production deployment.

## Boundary

Input, when eventually authorized, must be an already validated quarantine tree produced by the RamaVerse quarantine extraction gate plus its extraction manifest and the matching reconciliation plan.

Output is restricted to a fresh child directory of `.staging/ramaverse-rc-review`. Promotion is copy-only. Quarantine source files are never moved or deleted.

Only reconciliation actions explicitly classified for review may be copied:

- `review-canonical-candidate`
- `review-website-source`
- `review-documentation`
- `review-asset`
- `review-unknown`

The following never cross the promotion gate:

- Mobile/VC14
- generated/cache trees
- secret-like paths
- executable/script quarantine items
- cross-project blockers
- directory-only metadata

A canonical candidate remains only a **candidate** after promotion. No canonical winner is selected and no record is rewritten, deduplicated, translated, summarized, regenerated, published, or integrated automatically.

## Integrity checks

Before copying, the gate re-hashes each quarantine file and compares its size/hash with the extraction manifest. The reconciliation plan SHA-256 must match the quarantine manifest. Any plan blocker aborts the whole promotion. The destination must be fresh, contained under the staging root, and files use exclusive creation.

The promotion manifest records promoted/skipped paths and hashes while retaining `canonicalWinnerSelected=false`, `canonicalIntegrationAuthorized=false`, and `productionAuthorized=false`.

## Current authorization

`promotionAuthorized=false`

Real `.staging/` output is forbidden in clean CI and ignored from Git as a second containment boundary.
