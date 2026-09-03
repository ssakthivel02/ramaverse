import fs from "node:fs";

const routes = JSON.parse(fs.readFileSync("src/data/routes.json", "utf8"));
const experience = fs.readFileSync("src/data/experience.ts", "utf8");
const canonical = fs.readFileSync("src/lib/canonical.ts", "utf8");
const ingestionContract = JSON.parse(fs.readFileSync("docs/CANONICAL_INGESTION_CONTRACT.json", "utf8"));
const intakeContract = JSON.parse(fs.readFileSync("docs/RC_INTAKE_SAFETY_CONTRACT.json", "utf8"));
const reconciliationContract = JSON.parse(fs.readFileSync("docs/RECONCILIATION_PREP_CONTRACT.json", "utf8"));
const rcGate = JSON.parse(fs.readFileSync("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const index = fs.readFileSync("index.html", "utf8");
const main = fs.readFileSync("src/main.tsx", "utf8");

const fail = (message) => {
  console.error(`FOUNDATION_FAIL: ${message}`);
  process.exit(1);
};

if (routes.length !== 22) fail(`expected 22 routes, found ${routes.length}`);
if (new Set(routes.map((route) => route.path)).size !== 22) fail("route paths are not unique");
if (!routes.some((route) => route.path === "/knowledge")) fail("/knowledge is missing");
if (!routes.some((route) => route.path === "/sources")) fail("/sources is missing");

for (const route of routes.filter((item) => item.path !== "/")) {
  if (!experience.includes(`\"${route.path}\"`)) fail(`missing experience definition for ${route.path}`);
}

if (!canonical.includes("const EXPECTED_BASELINE = 550")) fail("canonical baseline invariant is not 550");
if (!canonical.includes("EXPECTED_ARCHIVE_SHA256")) fail("canonical source archive SHA-256 gate is missing");
if (!canonical.includes("manifest.integrationAuthorized !== true")) fail("canonical integration authorization gate is missing");
if (!canonical.includes('manifest.publicationState !== "validated"')) fail("canonical validated-publication gate is missing");
if (!canonical.includes("reconciliation?.missingRecords !== 0")) fail("canonical reconciliation gate is missing");
if (ingestionContract.expectedCanonicalBaseline !== 550) fail("ingestion contract baseline is not 550");
if (ingestionContract.expectedSourceArchive.sha256 !== rcGate.sha256) fail("ingestion contract RC SHA-256 drifted");
if (ingestionContract.regenerateMissingRecords !== false) fail("missing-record regeneration must remain prohibited");

if (intakeContract.authoritativeArchive.name !== rcGate.archive) fail("RC intake archive name drifted");
if (intakeContract.authoritativeArchive.sha256 !== rcGate.sha256) fail("RC intake archive SHA-256 drifted");
if (intakeContract.authoritativeArchive.bytes !== rcGate.zipBytes) fail("RC intake archive byte size drifted");
if (intakeContract.mode !== "inventory-only-before-extraction" || intakeContract.extract !== false) fail("RC intake must remain inventory-only with extraction disabled");
if (intakeContract.zip.allowMultiDisk !== false || intakeContract.zip.allowZip64 !== false) fail("ambiguous ZIP structures must remain prohibited at intake");
if (intakeContract.zip.allowEncryptedEntries !== false || intakeContract.zip.allowSymlinks !== false) fail("encrypted/symlink entries must remain prohibited at intake");

if (reconciliationContract.authoritativeArchive.name !== rcGate.archive || reconciliationContract.authoritativeArchive.sha256 !== rcGate.sha256 || reconciliationContract.authoritativeArchive.bytes !== rcGate.zipBytes) fail("reconciliation prep archive identity drifted");
if (reconciliationContract.expectedCanonicalBaseline !== 550) fail("reconciliation prep baseline is not 550");
if (reconciliationContract.mode !== "metadata-only-reconciliation-plan-before-extraction") fail("reconciliation prep must remain metadata-only");
if (reconciliationContract.scope.websiteOnly !== true || reconciliationContract.scope.mobileVc14MutationAllowed !== false) fail("reconciliation scope must remain website-only");
if (reconciliationContract.extractionAuthorized !== false || reconciliationContract.scope.automaticExtractionAllowed !== false) fail("reconciliation prep must not authorize extraction");
if (reconciliationContract.canonicalIntegrationAuthorized !== false || reconciliationContract.scope.automaticIntegrationAllowed !== false) fail("reconciliation prep must not authorize integration");
if (reconciliationContract.scope.automaticCanonicalWinnerAllowed !== false) fail("reconciliation prep must not auto-select canonical winners");
if (reconciliationContract.scope.canonicalRewriteAllowed !== false || reconciliationContract.scope.recordRegenerationAllowed !== false) fail("reconciliation prep must not rewrite/regenerate canonical records");
if (reconciliationContract.scope.crossProjectMixingAllowed !== false) fail("reconciliation prep must reject cross-project mixing");
if (reconciliationContract.productionAuthorized !== false) fail("reconciliation prep must not authorize production");

if (rcGate.integrationAuthorized !== false) fail("foundation stage unexpectedly authorizes canonical integration");
if (fs.existsSync("public/data/canonical-manifest.json")) fail("canonical manifest must remain absent while integration is unauthorized");
if (fs.existsSync("staging/canonical-import")) fail("canonical staging must remain absent while integration is unauthorized");
if (!fs.existsSync("public/sw.js")) fail("offline shell service worker is missing");
if (!main.includes('navigator.serviceWorker.register("/sw.js")')) fail("service worker registration is missing");
if (!index.includes("Content-Security-Policy")) fail("CSP metadata is missing");
if (!index.includes("strict-origin-when-cross-origin")) fail("referrer policy is missing");

console.log("FOUNDATION_CONTRACT_PASS");
console.log(`ROUTES=${routes.length}`);
console.log("CANONICAL_BASELINE=550");
console.log("RC_INTAKE_MODE=INVENTORY_ONLY");
console.log("RECONCILIATION_MODE=METADATA_ONLY_PRE_EXTRACTION");
console.log("RC_EXTRACTION_AUTHORIZED=false");
console.log("CANONICAL_PROVENANCE_GATE=ENFORCED");
console.log("CANONICAL_INTEGRATION_AUTHORIZED=false");
console.log("CANONICAL_MANIFEST=ABSENT_BY_DESIGN");
