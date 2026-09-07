import { readFile } from "node:fs/promises";

const gate = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const contract = JSON.parse(await readFile("docs/RC_INTAKE_SAFETY_CONTRACT.json", "utf8"));
const failures = [];
const requireRule = (condition, message) => {
  if (!condition) failures.push(message);
};

requireRule(contract.schemaVersion === 1, "unexpected intake contract schema version");
requireRule(contract.project === gate.project, "intake contract project drifted from RC gate");
requireRule(contract.authoritativeArchive?.name === gate.archive, "intake archive name drifted from RC gate");
requireRule(contract.authoritativeArchive?.sha256 === gate.sha256, "intake archive SHA-256 drifted from RC gate");
requireRule(contract.authoritativeArchive?.bytes === gate.zipBytes, "intake archive byte size drifted from RC gate");
requireRule(contract.mode === "inventory-only-before-extraction", "intake mode must remain inventory-only");
requireRule(contract.extract === false, "intake contract must not authorize extraction");
requireRule(contract.canonicalIntegrationAuthorized === false, "intake contract must not authorize canonical integration");
requireRule(contract.zip?.allowMultiDisk === false, "multi-disk ZIP must remain prohibited");
requireRule(contract.zip?.allowZip64 === false, "ZIP64 must remain prohibited at intake");
requireRule(contract.zip?.allowEncryptedEntries === false, "encrypted ZIP entries must remain prohibited");
requireRule(contract.zip?.allowSymlinks === false, "symlink ZIP entries must remain prohibited");
requireRule(JSON.stringify(contract.zip?.allowedCompressionMethods) === JSON.stringify([0, 8]), "compression method allow-list drifted");
requireRule(contract.zip?.rejectAbsolutePaths === true, "absolute path rejection must remain enabled");
requireRule(contract.zip?.rejectParentTraversal === true, "parent traversal rejection must remain enabled");
requireRule(contract.zip?.rejectBackslashPaths === true, "backslash path rejection must remain enabled");
requireRule(contract.zip?.rejectCaseInsensitiveDuplicates === true, "case-insensitive duplicate rejection must remain enabled");
requireRule(contract.zip?.rejectWindowsReservedNames === true, "Windows reserved-name rejection must remain enabled");
requireRule(contract.zip?.requireLocalCentralNameMatch === true, "local/central filename matching must remain required");
requireRule(contract.zip?.rejectOverlappingDataRanges === true, "overlapping entry range rejection must remain enabled");
requireRule(Number.isInteger(contract.zip?.maxEntries) && contract.zip.maxEntries > 0 && contract.zip.maxEntries <= 20000, "maxEntries is missing or too permissive");
requireRule(Number.isInteger(contract.zip?.maxEntryNameBytes) && contract.zip.maxEntryNameBytes > 0 && contract.zip.maxEntryNameBytes <= 1024, "maxEntryNameBytes is missing or too permissive");
requireRule(Number.isInteger(contract.zip?.maxEntryUncompressedBytes) && contract.zip.maxEntryUncompressedBytes > 0 && contract.zip.maxEntryUncompressedBytes <= 268435456, "per-entry uncompressed limit is missing or too permissive");
requireRule(Number.isInteger(contract.zip?.maxTotalUncompressedBytes) && contract.zip.maxTotalUncompressedBytes > 0 && contract.zip.maxTotalUncompressedBytes <= 1073741824, "total uncompressed limit is missing or too permissive");
requireRule(typeof contract.zip?.maxCompressionRatio === "number" && contract.zip.maxCompressionRatio > 0 && contract.zip.maxCompressionRatio <= 200, "compression-ratio limit is missing or too permissive");

if (failures.length) {
  console.error(`RC_INTAKE_SAFETY_CONTRACT_FAIL: ${failures.join("; ")}`);
  process.exit(1);
}

console.log("RC_INTAKE_SAFETY_CONTRACT_PASS");
console.log(`AUTHORITATIVE_RC_SHA256=${gate.sha256}`);
console.log("INTAKE_MODE=INVENTORY_ONLY");
console.log("EXTRACTION_AUTHORIZED=false");
console.log("CANONICAL_INTEGRATION_AUTHORIZED=false");
