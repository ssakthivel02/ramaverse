import { readFile } from "node:fs/promises";
import { requireRcIdentity } from "./lib/rc-identity.mjs";
import { inspectZipBuffer } from "./lib/zip-intake.mjs";

const candidate = process.argv[2];
if (!candidate) {
  console.error("Usage: node scripts/inventory-authoritative-rc.mjs <RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip>");
  process.exit(2);
}

const gate = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const contract = JSON.parse(await readFile("docs/RC_INTAKE_SAFETY_CONTRACT.json", "utf8"));

try {
  if (
    contract.project !== gate.project ||
    contract.authoritativeArchive.name !== gate.archive ||
    contract.authoritativeArchive.sha256 !== gate.sha256 ||
    contract.authoritativeArchive.bytes !== gate.zipBytes
  ) {
    throw new Error("RC_INTAKE_CONTRACT_FAIL: intake contract does not match the authoritative RC gate");
  }
  if (contract.extract !== false || contract.mode !== "inventory-only-before-extraction") {
    throw new Error("RC_INTAKE_CONTRACT_FAIL: intake stage must remain inventory-only");
  }

  const identity = await requireRcIdentity(candidate, gate);
  const archive = await readFile(candidate);
  const inventory = inspectZipBuffer(archive, contract.zip);
  const report = {
    schemaVersion: contract.schemaVersion,
    project: gate.project,
    archive: {
      name: identity.candidate,
      bytes: identity.bytes,
      sha256: identity.sha256,
      identityChecks: identity.checks,
    },
    policy: {
      mode: contract.mode,
      extract: false,
      integrationAuthorized: gate.integrationAuthorized,
      productionAuthorized: gate.productionAuthorized,
    },
    inventory,
  };

  console.log(JSON.stringify(report, null, 2));
  console.log("RC_INTAKE_SAFETY_PASS: authoritative archive identity and ZIP structure passed inventory-only checks. No extraction was performed.");
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
