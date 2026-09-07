import { readFile } from "node:fs/promises";

const contract = JSON.parse(await readFile("docs/QUARANTINE_EXTRACTION_CONTRACT.json", "utf8"));
const rc = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const intake = JSON.parse(await readFile("docs/RC_INTAKE_SAFETY_CONTRACT.json", "utf8"));
const reconciliation = JSON.parse(await readFile("docs/RECONCILIATION_PREP_CONTRACT.json", "utf8"));

function fail(message) {
  console.error(`QUARANTINE_EXTRACTION_CONTRACT_FAIL: ${message}`);
  process.exit(1);
}

if (contract.schemaVersion !== 1 || contract.project !== "RamaVerse") fail("contract identity changed");
if (contract.mode !== "verified-archive-to-disposable-quarantine-only") fail("mode changed");
if (contract.authoritativeArchive.name !== rc.archive || contract.authoritativeArchive.name !== intake.authoritativeArchive.name || contract.authoritativeArchive.name !== reconciliation.authoritativeArchive.name) fail("archive name drifted");
if (contract.authoritativeArchive.sha256 !== rc.sha256 || contract.authoritativeArchive.sha256 !== intake.authoritativeArchive.sha256 || contract.authoritativeArchive.sha256 !== reconciliation.authoritativeArchive.sha256) fail("archive SHA-256 drifted");
if (contract.authoritativeArchive.bytes !== rc.zipBytes || contract.authoritativeArchive.bytes !== intake.authoritativeArchive.bytes || contract.authoritativeArchive.bytes !== reconciliation.authoritativeArchive.bytes) fail("archive byte size drifted");
if (contract.expectedCanonicalBaseline !== 550 || contract.expectedCanonicalBaseline !== rc.canonicalBaseline) fail("canonical baseline drifted");
if (contract.requiredReconciliationMode !== reconciliation.mode) fail("required reconciliation mode drifted");
if (contract.quarantineRoot !== ".quarantine/ramaverse-rc") fail("quarantine root drifted");
if (contract.extractionAuthorized !== false) fail("real RC extraction must remain unauthorized");
if (contract.canonicalIntegrationAuthorized !== false || contract.productionAuthorized !== false) fail("integration/production must remain unauthorized");
if (rc.integrationAuthorized !== false || rc.productionAuthorized !== false) fail("authoritative RC gate unexpectedly authorizes integration/production");
if (intake.extract !== false || reconciliation.extractionAuthorized !== false) fail("upstream gates unexpectedly authorize extraction");

const requiredFalse = [
  "sourceTreeMutationAllowed",
  "publicTreeMutationAllowed",
  "stagingCanonicalMutationAllowed",
  "mobileVc14MutationAllowed",
  "canonicalRewriteAllowed",
  "recordRegenerationAllowed",
  "productionMutationAllowed"
];
for (const key of requiredFalse) if (contract.requirements[key] !== false) fail(`${key} must remain false`);
for (const key of ["archiveIdentityMustPass", "zipIntakeMustPass", "reconciliationPlanMustMatchArchive", "oneDecisionPerInventoryEntry", "planBlockersMustEqualZero", "destinationMustBeEmpty", "destinationMustRemainInsideQuarantineRoot", "localCentralMetadataMustMatch", "crc32MustMatch", "uncompressedSizeMustMatch", "writeFilesWithExclusiveCreate", "preserveArchivePathOnlyInsideQuarantine", "writeExtractionManifest", "manifestMustHashEveryExtractedFile"]) {
  if (contract.requirements[key] !== true) fail(`${key} must remain true`);
}
if (contract.allowedCompressionMethods.join(",") !== "0,8") fail("extraction compression methods drifted");
if (!contract.blockedPlanActions.includes("reject-cross-project")) fail("cross-project blocker is missing");
if (contract.allowedPlanActions.includes("reject-cross-project")) fail("cross-project rejection action became extractable");

console.log("QUARANTINE_EXTRACTION_CONTRACT_PASS");
console.log("REAL_RC_EXTRACTION_AUTHORIZED=false");
console.log("DESTINATION=DISPOSABLE_QUARANTINE_ONLY");
console.log("SOURCE_PUBLIC_MOBILE_CANONICAL_PRODUCTION_MUTATION=false");
console.log("CANONICAL_INTEGRATION_AUTHORIZED=false");
console.log("PRODUCTION_AUTHORIZED=false");
