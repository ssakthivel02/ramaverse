import { readFile } from "node:fs/promises";

const contract = JSON.parse(await readFile("docs/STAGING_PROMOTION_CONTRACT.json", "utf8"));
const quarantine = JSON.parse(await readFile("docs/QUARANTINE_EXTRACTION_CONTRACT.json", "utf8"));
const rc = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const fail = (message) => { console.error(`STAGING_PROMOTION_CONTRACT_FAIL: ${message}`); process.exit(1); };

if (contract.schemaVersion !== 1 || contract.project !== "RamaVerse") fail("contract identity changed");
if (contract.mode !== "validated-quarantine-to-isolated-review-staging-only") fail("mode changed");
if (contract.requiredQuarantineMode !== quarantine.mode) fail("quarantine mode linkage changed");
if (contract.authoritativeArchive.name !== rc.archive || contract.authoritativeArchive.sha256 !== rc.sha256 || contract.authoritativeArchive.bytes !== rc.zipBytes) fail("authoritative archive identity drifted");
if (contract.expectedCanonicalBaseline !== 550) fail("canonical baseline changed");
if (!String(contract.stagingRoot).startsWith(".staging/")) fail("staging root is not isolated");
if (contract.promotionAuthorized !== false || contract.canonicalIntegrationAuthorized !== false || contract.productionAuthorized !== false) fail("checked-in authorization unexpectedly enabled");
for (const [key, expected] of Object.entries({ sourceTreeMutationAllowed:false, publicTreeMutationAllowed:false, canonicalPublicationMutationAllowed:false, mobileVc14MutationAllowed:false, canonicalWinnerSelectionAllowed:false, canonicalRewriteAllowed:false, recordRegenerationAllowed:false, productionMutationAllowed:false, copyOnlyNoMoveDelete:true, quarantineFileHashRecheckRequired:true, destinationMustBeFresh:true, destinationMustRemainInsideStagingRoot:true, exclusiveFileCreate:true, deterministicPromotionManifest:true })) {
  if (contract.requirements[key] !== expected) fail(`${key} must remain ${expected}`);
}
const allowed = new Set(contract.allowedPromotionActions);
for (const action of ["review-canonical-candidate","review-website-source","review-documentation","review-asset","review-unknown"]) if (!allowed.has(action)) fail(`missing allowed review action ${action}`);
const never = new Set(contract.neverPromoteActions);
for (const action of ["quarantine-mobile-vc14","quarantine-generated-cache","quarantine-secret-like","quarantine-executable","reject-cross-project"]) if (!never.has(action)) fail(`missing forbidden promotion action ${action}`);
console.log("STAGING_PROMOTION_CONTRACT_PASS");
console.log("REAL_PROMOTION_AUTHORIZED=false");
console.log("CANONICAL_WINNER_SELECTION=false");
console.log("CANONICAL_INTEGRATION_AUTHORIZED=false");
console.log("PRODUCTION_AUTHORIZED=false");
