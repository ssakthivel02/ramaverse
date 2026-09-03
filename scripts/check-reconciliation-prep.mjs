import { readFile } from "node:fs/promises";

const contract = JSON.parse(await readFile("docs/RECONCILIATION_PREP_CONTRACT.json", "utf8"));
const rcGate = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const intake = JSON.parse(await readFile("docs/RC_INTAKE_SAFETY_CONTRACT.json", "utf8"));

function fail(message) {
  console.error(`RECONCILIATION_PREP_CONTRACT_FAIL: ${message}`);
  process.exit(1);
}

if (contract.schemaVersion !== 1) fail("unexpected schemaVersion");
if (contract.project !== "RamaVerse" || contract.project !== rcGate.project || contract.project !== intake.project) fail("project mismatch");
if (contract.mode !== "metadata-only-reconciliation-plan-before-extraction") fail("mode drifted from metadata-only preparation");
if (contract.authoritativeArchive.name !== rcGate.archive || contract.authoritativeArchive.name !== intake.authoritativeArchive.name) fail("archive name mismatch");
if (contract.authoritativeArchive.sha256 !== rcGate.sha256 || contract.authoritativeArchive.sha256 !== intake.authoritativeArchive.sha256) fail("archive SHA-256 mismatch");
if (contract.authoritativeArchive.bytes !== rcGate.zipBytes || contract.authoritativeArchive.bytes !== intake.authoritativeArchive.bytes) fail("archive byte-size mismatch");
if (contract.expectedCanonicalBaseline !== 550 || contract.expectedCanonicalBaseline !== rcGate.canonicalBaseline) fail("canonical baseline mismatch");

if (contract.scope.websiteOnly !== true) fail("websiteOnly must be true");
if (contract.scope.mobileVc14MutationAllowed !== false) fail("Mobile/VC14 mutation must remain false");
if (contract.scope.automaticExtractionAllowed !== false || contract.extractionAuthorized !== false) fail("extraction must remain false");
if (contract.scope.automaticIntegrationAllowed !== false || contract.canonicalIntegrationAuthorized !== false) fail("integration must remain false");
if (contract.scope.automaticCanonicalWinnerAllowed !== false) fail("automatic canonical winner must remain false");
if (contract.scope.canonicalRewriteAllowed !== false || contract.scope.recordRegenerationAllowed !== false) fail("canonical rewrite/regeneration must remain false");
if (contract.scope.crossProjectMixingAllowed !== false) fail("cross-project mixing must remain false");
if (contract.productionAuthorized !== false) fail("production authorization must remain false");
if (intake.extract !== false || intake.canonicalIntegrationAuthorized !== false) fail("upstream RC intake gate is not fail-closed");
if (rcGate.integrationAuthorized !== false || rcGate.productionAuthorized !== false) fail("authoritative RC gate unexpectedly authorizes integration/production");

const requiredActions = [
  "directory-metadata-only",
  "review-canonical-candidate",
  "review-website-source",
  "review-documentation",
  "review-asset",
  "review-unknown",
  "quarantine-mobile-vc14",
  "quarantine-generated-cache",
  "quarantine-secret-like",
  "quarantine-executable",
  "reject-cross-project"
];
for (const action of requiredActions) if (!contract.actions.includes(action)) fail(`required action missing: ${action}`);
for (const signal of ["KirthiVerse", "DivyaNexus", "OmSaravanaBhava", "SakthiAI", "SaravanAI"]) {
  if (!contract.classification.crossProjectSignals.includes(signal)) fail(`cross-project rejection signal missing: ${signal}`);
}
if (contract.planRequirements.preserveEveryInventoryEntry !== true || contract.planRequirements.oneDecisionPerInventoryEntry !== true) fail("entry preservation requirements are not enforced");
if (contract.planRequirements.planDoesNotExtract !== true || contract.planRequirements.planDoesNotCopy !== true || contract.planRequirements.planDoesNotRewrite !== true || contract.planRequirements.planDoesNotPublish !== true) fail("planner side-effect prohibitions drifted");

console.log("RECONCILIATION_PREP_CONTRACT_PASS");
console.log("EXPECTED_CANONICAL_BASELINE=550");
console.log("MODE=METADATA_ONLY_PRE_EXTRACTION");
console.log("EXTRACTION_AUTHORIZED=false");
console.log("CANONICAL_INTEGRATION_AUTHORIZED=false");
console.log("PRODUCTION_AUTHORIZED=false");
