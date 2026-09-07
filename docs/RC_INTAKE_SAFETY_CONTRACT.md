# RamaVerse Authoritative RC Intake Safety Contract

This stage is deliberately **inventory-only**. It exists to decide whether the already-identified authoritative RC archive is structurally safe enough to proceed to a separate extraction/reconciliation stage. It does not extract files, authorize canonical integration, publish data, deploy production, or modify Mobile/VC14.

## Identity before structure

The scanner must first prove the candidate is exactly `RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip`, 5,311,980 bytes, SHA-256 `fccb48547e795c1927453fe838e5ec745c71bfe80702bb246a40cd0c66b94983`. A mismatched candidate is rejected before ZIP parsing.

## ZIP structure rules

The inventory scan fails closed when it sees any of the following:

- multi-disk or ZIP64 structures;
- encrypted entries;
- symlink entries;
- compression methods other than STORE (0) or DEFLATE (8);
- absolute, parent-traversal or backslash paths;
- Windows device/reserved path segments or trailing dot/space segments;
- duplicate paths, including case-insensitive collisions that can overwrite files on common filesystems;
- excessive entry counts, filename lengths, individual uncompressed sizes, total uncompressed size, or compression ratios;
- central-directory/local-header filename disagreement;
- entry data ranges that escape the pre-central-directory region or overlap another entry's data.

A clean inventory is not canonical approval. It only establishes that a cryptographically correct archive has a bounded, non-ambiguous ZIP structure suitable for the next controlled operation.

## Non-goals

No extraction is performed by this scanner. No archive contents are interpreted as canonical records. No missing record is regenerated. `integrationAuthorized` and `productionAuthorized` remain false until later evidence explicitly changes those gates.
