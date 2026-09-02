import fs from "node:fs";

const routes = JSON.parse(fs.readFileSync("src/data/routes.json", "utf8"));
const experience = fs.readFileSync("src/data/experience.ts", "utf8");
const canonical = fs.readFileSync("src/lib/canonical.ts", "utf8");
const ingestionContract = JSON.parse(fs.readFileSync("docs/CANONICAL_INGESTION_CONTRACT.json", "utf8"));
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
console.log("CANONICAL_PROVENANCE_GATE=ENFORCED");
console.log("CANONICAL_INTEGRATION_AUTHORIZED=false");
console.log("CANONICAL_MANIFEST=ABSENT_BY_DESIGN");
