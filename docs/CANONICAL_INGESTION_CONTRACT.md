# RamaVerse Canonical Ingestion Contract

This stage defines the only permitted path from the authoritative RamaVerse RC archive into the next-generation website. It does **not** authorize integration or production publication.

## Authority boundary

The source candidate is fixed to `RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip`, SHA-256 `fccb48547e795c1927453fe838e5ec745c71bfe80702bb246a40cd0c66b94983`, byte size `5311980`. The expected canonical baseline is exactly `550` records.

`docs/AUTHORITATIVE_RC_GATE.json` remains the authorization control. While `integrationAuthorized` is `false`, canonical staging and canonical publication are both prohibited. Missing records must never be regenerated, inferred, synthesized, or silently replaced.

## Normalized reconciliation envelope

Each reconciled record must be preserved inside a neutral envelope:

- `recordId`: globally unique stable identifier assigned by the reconciliation process.
- `collection`: manifest collection identifier.
- `sourcePath`: exact path/location in the verified RC extraction from which the record was recovered.
- `payloadSha256`: SHA-256 of deterministic canonical JSON for the preserved `payload`.
- `payload`: the recovered canonical record without semantic rewriting.

The envelope exists to prove identity and provenance without assuming the legacy source uses a particular internal schema.

## Manifest requirements

A staging manifest is valid only when all of the following are true:

- schema version and project identity match this contract;
- archive name, SHA-256 and byte size match the authoritative gate;
- `canonicalBaseline` and `recordCount` are exactly `550`;
- integration authorization is explicitly true in both the gate and staging manifest;
- publication state is exactly `validated`;
- every collection file is JSONL beneath `collections/` and matches its declared SHA-256 and record count;
- every record envelope is structurally valid;
- every `recordId` is unique across the complete corpus;
- each record's deterministic payload hash matches `payloadSha256`;
- collection counts sum to exactly `550`;
- missing, duplicate, malformed and hash-mismatch reconciliation counters are all zero.

## Fail-closed publication rule

The public website must not treat canonical content as ready merely because a file says `approved: true`. The browser status contract requires the authoritative archive identity, exactly 550 records, validated publication state, explicit integration authorization, zero reconciliation errors, and internally consistent collection counts/hashes.

Until the authoritative archive is available and its record-by-record reconciliation is completed, `/data/canonical-manifest.json` and canonical publication files must remain absent.

## Non-goals

This stage does not extract the RC archive, does not import the 550 records, does not modify Mobile/VC14, does not touch `main`, does not deploy production, and does not create replacement content.
