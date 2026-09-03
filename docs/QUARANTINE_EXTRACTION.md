# RamaVerse Quarantine Extraction Gate

This stage defines the **only permitted shape of a future archive extraction**: exact verified RamaVerse RC → disposable quarantine directory. It does not authorize that extraction today.

## Current state

`docs/QUARANTINE_EXTRACTION_CONTRACT.json` keeps:

- `extractionAuthorized: false`
- `canonicalIntegrationAuthorized: false`
- `productionAuthorized: false`

Therefore the real extraction command must refuse to run until a separate reviewed change explicitly enables extraction after the exact RC archive, inventory and reconciliation plan exist.

## Required chain before extraction

1. Verify exact RC filename, byte size and SHA-256.
2. Re-run ZIP intake safety against the archive bytes.
3. Require the saved inventory to exactly match the fresh ZIP inventory.
4. Require a deterministic reconciliation plan for every inventory entry.
5. Require zero plan blockers.
6. Require explicit extraction authorization.
7. Extract only beneath a disposable quarantine root.
8. Re-check local ZIP metadata, decompression size and CRC32 while extracting.
9. Write files with exclusive creation; never overwrite an existing quarantine destination.
10. Produce an extraction manifest with SHA-256 for every extracted file.

## Explicitly forbidden

Quarantine extraction does not mean integration. The extractor must not write to:

- `src/`
- `public/`
- canonical staging/publication locations
- Mobile / Android / iOS / VC14 trees
- production locations

It must not rewrite, deduplicate, translate, summarize, synthesize or regenerate canonical records.

## Future command

The command exists so the full boundary can be tested, but the checked-in contract intentionally makes it fail closed:

```bash
npm run extract:rc-quarantine -- \
  RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip \
  rc-inventory.json \
  rc-reconciliation-plan.json \
  .quarantine/ramaverse-rc/run-001
```

Until `extractionAuthorized` is explicitly changed through a reviewed gate, the expected result is refusal with no filesystem mutation.

CI tests the extraction primitive only with a synthetic ZIP and a synthetic temporary authorization object inside the operating-system temp directory. No real RamaVerse RC bytes or canonical records are used in that test.
