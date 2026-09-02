import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { validateStagingBundle } from "./lib/canonical-ingestion.mjs";

const gate = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const contract = JSON.parse(await readFile("docs/CANONICAL_INGESTION_CONTRACT.json", "utf8"));

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const failures = [];
if (contract.project !== gate.project) failures.push("contract project does not match authoritative gate");
if (contract.expectedSourceArchive.name !== gate.archive) failures.push("contract archive name does not match authoritative gate");
if (contract.expectedSourceArchive.sha256 !== gate.sha256) failures.push("contract archive SHA-256 does not match authoritative gate");
if (contract.expectedSourceArchive.bytes !== gate.zipBytes) failures.push("contract archive byte size does not match authoritative gate");
if (contract.expectedCanonicalBaseline !== gate.canonicalBaseline) failures.push("contract canonical baseline does not match authoritative gate");
if (contract.regenerateMissingRecords !== false) failures.push("contract must prohibit regeneration of missing records");

const stagingRoot = contract.stagingRoot;
const publicManifest = join(contract.publicationRoot, "canonical-manifest.json");
const publicCanonicalRoot = join(contract.publicationRoot, "canonical");
const stagingPresent = await exists(stagingRoot);
const publicationPresent = (await exists(publicManifest)) || (await exists(publicCanonicalRoot));

if (gate.integrationAuthorized !== true) {
  if (stagingPresent) failures.push("canonical staging exists while integration is unauthorized");
  if (publicationPresent) failures.push("canonical publication exists while integration is unauthorized");

  if (failures.length) {
    console.error(`CANONICAL_INGESTION_GATE_FAIL: ${failures.join("; ")}`);
    process.exit(1);
  }

  console.log("CANONICAL_INGESTION_GATE_PASS");
  console.log("INTEGRATION_AUTHORIZED=false");
  console.log("CANONICAL_STAGING=ABSENT");
  console.log("CANONICAL_PUBLICATION=ABSENT");
  console.log("EXPECTED_BASELINE=550");
  process.exit(0);
}

if (failures.length) {
  console.error(`CANONICAL_INGESTION_GATE_FAIL: ${failures.join("; ")}`);
  process.exit(1);
}

if (!stagingPresent) {
  console.error("CANONICAL_INGESTION_GATE_FAIL: integration is authorized but staging bundle is absent");
  process.exit(1);
}

const result = await validateStagingBundle({ stagingRoot, contract, gate });
console.log("CANONICAL_INGESTION_GATE_PASS");
console.log("INTEGRATION_AUTHORIZED=true");
console.log(`VALIDATED_RECORDS=${result.totalRecords}`);
console.log(`UNIQUE_RECORD_IDS=${result.uniqueRecordIds}`);
console.log("PUBLICATION_NOT_PERFORMED_BY_THIS_CHECK=true");
