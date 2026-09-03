# RamaVerse Reconciliation Preparation

This stage prepares a deterministic reconciliation plan **before any RC extraction**.

## Boundary

The only accepted upstream evidence is an inventory report produced by the authoritative RC intake gate after the archive name, byte size and SHA-256 have matched `docs/AUTHORITATIVE_RC_GATE.json` and ZIP structure has passed `docs/RC_INTAKE_SAFETY_CONTRACT.json`.

This stage does **not**:

- extract archive entries;
- copy files into the website;
- import canonical records;
- choose between historical corpus baselines;
- rewrite, deduplicate, translate, summarize or regenerate canonical content;
- modify Mobile, Android, iOS or VC14 source;
- merge unrelated project data;
- authorize production.

## What the planner does

For every inventory entry it emits exactly one deterministic disposition while preserving the original archive path and inventory metadata. Dispositions are review/quarantine decisions only:

- `review-canonical-candidate`
- `review-website-source`
- `review-documentation`
- `review-asset`
- `review-unknown`
- `directory-metadata-only`
- `quarantine-mobile-vc14`
- `quarantine-generated-cache`
- `quarantine-secret-like`
- `quarantine-executable`
- `reject-cross-project`

Cross-project signals are blockers. Secret-like or executable files, generated/cache trees and Mobile/VC14 paths are quarantined from website recovery. A canonical-looking file is only a **candidate for later record-level reconciliation**; its path does not make its content authoritative.

## Determinism and completeness

The plan must:

1. match the authoritative RC identity;
2. preserve every inventory entry exactly once;
3. reject duplicate inventory paths;
4. preserve original path/size/compression metadata;
5. emit deterministic summary counts and a deterministic plan SHA-256;
6. keep extraction, integration and production authorization false;
7. expose blockers rather than silently skipping them.

## Next authorized operation

When the exact RC archive is supplied and its inventory passes the intake gate, run:

```bash
npm run inventory:rc -- RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip > rc-inventory.json
npm run plan:reconciliation -- rc-inventory.json > rc-reconciliation-plan.json
```

Even after both commands pass, extraction remains prohibited until a separate extraction/quarantine contract is reviewed and explicitly enabled. The plan is evidence for that future decision, not permission to import anything.
