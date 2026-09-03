import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";

const SHA256_RE = /^[a-f0-9]{64}$/;

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function payloadSha256(payload) {
  return sha256(stableStringify(payload));
}

function addFailure(failures, condition, message) {
  if (!condition) failures.push(message);
}

function isSafeCollectionPath(path) {
  if (typeof path !== "string" || !path.startsWith("collections/") || !path.endsWith(".jsonl")) return false;
  if (isAbsolute(path) || path.includes("..") || path.includes("\\")) return false;
  const normalized = normalize(path);
  return normalized === path && !normalized.startsWith(`..${sep}`);
}

export function validateManifestIdentity(manifest, contract, gate) {
  const failures = [];
  const expectedArchive = contract.expectedSourceArchive;

  addFailure(failures, manifest?.schemaVersion === contract.schemaVersion, "manifest schemaVersion mismatch");
  addFailure(failures, manifest?.project === contract.project, "manifest project mismatch");
  addFailure(failures, manifest?.sourceArchive?.name === expectedArchive.name, "source archive name mismatch");
  addFailure(failures, manifest?.sourceArchive?.sha256 === expectedArchive.sha256, "source archive SHA-256 mismatch");
  addFailure(failures, manifest?.sourceArchive?.bytes === expectedArchive.bytes, "source archive byte size mismatch");
  addFailure(failures, manifest?.canonicalBaseline === contract.expectedCanonicalBaseline, "canonical baseline mismatch");
  addFailure(failures, manifest?.recordCount === contract.expectedCanonicalBaseline, "record count must equal canonical baseline");
  addFailure(failures, manifest?.integrationAuthorized === true, "manifest integration authorization is not true");
  addFailure(failures, gate?.integrationAuthorized === true, "authoritative gate integration authorization is not true");
  addFailure(failures, manifest?.publicationState === contract.publicationStateRequired, "publication state is not validated");

  const requiredReconciliation = contract.reconciliationMustEqual;
  for (const [key, expected] of Object.entries(requiredReconciliation)) {
    addFailure(failures, manifest?.reconciliation?.[key] === expected, `reconciliation ${key} must equal ${expected}`);
  }

  addFailure(failures, Array.isArray(manifest?.collections) && manifest.collections.length > 0, "manifest collections must be non-empty");

  if (Array.isArray(manifest?.collections)) {
    const collectionIds = new Set();
    let sum = 0;
    for (const collection of manifest.collections) {
      addFailure(failures, typeof collection?.id === "string" && collection.id.length > 0, "collection id missing");
      addFailure(failures, !collectionIds.has(collection?.id), `duplicate collection id: ${collection?.id ?? "<missing>"}`);
      if (typeof collection?.id === "string") collectionIds.add(collection.id);
      addFailure(failures, Number.isInteger(collection?.recordCount) && collection.recordCount >= 0, `invalid record count for ${collection?.id ?? "<missing>"}`);
      if (Number.isInteger(collection?.recordCount)) sum += collection.recordCount;
      addFailure(failures, isSafeCollectionPath(collection?.file), `unsafe collection path for ${collection?.id ?? "<missing>"}`);
      addFailure(failures, SHA256_RE.test(collection?.sha256 ?? ""), `invalid collection SHA-256 for ${collection?.id ?? "<missing>"}`);
    }
    addFailure(failures, sum === contract.expectedCanonicalBaseline, `collection counts sum to ${sum}, expected ${contract.expectedCanonicalBaseline}`);
  }

  return failures;
}

export function validateRecordEnvelope(record, expectedCollection, globalIds) {
  const failures = [];
  addFailure(failures, record && typeof record === "object" && !Array.isArray(record), "record must be an object");
  addFailure(failures, typeof record?.recordId === "string" && record.recordId.trim().length > 0, "recordId missing");
  addFailure(failures, record?.collection === expectedCollection, `record collection mismatch for ${record?.recordId ?? "<missing>"}`);
  addFailure(failures, typeof record?.sourcePath === "string" && record.sourcePath.trim().length > 0, `sourcePath missing for ${record?.recordId ?? "<missing>"}`);
  addFailure(failures, SHA256_RE.test(record?.payloadSha256 ?? ""), `payloadSha256 invalid for ${record?.recordId ?? "<missing>"}`);
  addFailure(failures, Object.prototype.hasOwnProperty.call(record ?? {}, "payload"), `payload missing for ${record?.recordId ?? "<missing>"}`);

  if (typeof record?.recordId === "string") {
    addFailure(failures, !globalIds.has(record.recordId), `duplicate global recordId: ${record.recordId}`);
    globalIds.add(record.recordId);
  }

  if (record && Object.prototype.hasOwnProperty.call(record, "payload") && SHA256_RE.test(record?.payloadSha256 ?? "")) {
    const actual = payloadSha256(record.payload);
    addFailure(failures, actual === record.payloadSha256, `payload hash mismatch for ${record?.recordId ?? "<missing>"}`);
  }

  return failures;
}

export async function validateStagingBundle({ stagingRoot, contract, gate }) {
  const manifestPath = join(stagingRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const failures = validateManifestIdentity(manifest, contract, gate);
  const globalIds = new Set();
  let totalRecords = 0;

  if (Array.isArray(manifest.collections)) {
    for (const collection of manifest.collections) {
      if (!isSafeCollectionPath(collection.file)) continue;
      const collectionPath = join(stagingRoot, collection.file);
      const raw = await readFile(collectionPath);
      const actualFileHash = sha256(raw);
      if (actualFileHash !== collection.sha256) failures.push(`collection file SHA-256 mismatch: ${collection.id}`);

      const lines = raw.toString("utf8").split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length !== collection.recordCount) failures.push(`collection record count mismatch: ${collection.id}`);
      totalRecords += lines.length;

      lines.forEach((line, index) => {
        try {
          const record = JSON.parse(line);
          failures.push(...validateRecordEnvelope(record, collection.id, globalIds).map((failure) => `${collection.id}:${index + 1}: ${failure}`));
        } catch {
          failures.push(`${collection.id}:${index + 1}: malformed JSONL record`);
        }
      });
    }
  }

  if (totalRecords !== contract.expectedCanonicalBaseline) {
    failures.push(`validated record total ${totalRecords}, expected ${contract.expectedCanonicalBaseline}`);
  }

  if (failures.length) throw new Error(`CANONICAL_INGESTION_FAIL: ${failures.join("; ")}`);
  return { manifest, totalRecords, uniqueRecordIds: globalIds.size };
}
