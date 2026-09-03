import fs from "node:fs";

const gate = JSON.parse(fs.readFileSync("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const expectedSha = "fccb48547e795c1927453fe838e5ec745c71bfe80702bb246a40cd0c66b94983";

const failures = [];
if (gate.project !== "RamaVerse") failures.push("project identity changed");
if (gate.archive !== "RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip") failures.push("archive name changed");
if (gate.sha256 !== expectedSha) failures.push("authoritative RC SHA-256 changed");
if (gate.zipBytes !== 5311980) failures.push("validated archive byte size changed");
if (gate.canonicalBaseline !== 550) failures.push("canonical baseline changed");
if (gate.integrationAuthorized !== false) failures.push("integration was marked authorized without recovery/reconciliation");
if (gate.productionAuthorized !== false) failures.push("production was marked authorized");

if (failures.length) {
  console.error(`RC_GATE_CONTRACT_FAIL: ${failures.join("; ")}`);
  process.exit(1);
}

console.log("RC_GATE_CONTRACT_PASS");
console.log(`EXPECTED_SHA256=${expectedSha}`);
console.log("INTEGRATION_AUTHORIZED=false");
console.log("PRODUCTION_AUTHORIZED=false");
