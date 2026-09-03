import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { inspectZipBuffer } from "./lib/zip-intake.mjs";
import { buildReconciliationPlan } from "./lib/reconciliation-plan.mjs";
import { extractVerifiedArchiveToQuarantine, loadJson } from "./lib/quarantine-extraction.mjs";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(specs) {
  const locals = [];
  const centrals = [];
  let localOffset = 0;
  for (const spec of specs) {
    const nameBytes = Buffer.from(spec.name, "utf8");
    const data = Buffer.from(spec.data ?? "", "utf8");
    const method = spec.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const flags = 0x0800;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const localRecord = Buffer.concat([local, nameBytes, compressed]);
    locals.push(localRecord);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(localOffset, 42);
    centrals.push(Buffer.concat([central, nameBytes]));
    localOffset += localRecord.length;
  }
  const localRegion = Buffer.concat(locals);
  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(specs.length, 8);
  eocd.writeUInt16LE(specs.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localRegion.length, 16);
  return Buffer.concat([localRegion, centralDirectory, eocd]);
}

const [realExtractionContract, intakeContract, reconciliationContract] = await Promise.all([
  loadJson("docs/QUARANTINE_EXTRACTION_CONTRACT.json"),
  loadJson("docs/RC_INTAKE_SAFETY_CONTRACT.json"),
  loadJson("docs/RECONCILIATION_PREP_CONTRACT.json")
]);

function makeContext(specs) {
  const archiveBuffer = buildZip(specs);
  const identity = {
    name: "synthetic-rc.zip",
    sha256: createHash("sha256").update(archiveBuffer).digest("hex"),
    bytes: archiveBuffer.length
  };
  const inventory = inspectZipBuffer(archiveBuffer, intakeContract.zip);
  const inventoryReport = {
    schemaVersion: 1,
    project: "RamaVerse",
    archive: { ...identity, identityChecks: { fileName: true, byteSize: true, sha256: true } },
    policy: { mode: "inventory-only-before-extraction", extract: false, integrationAuthorized: false, productionAuthorized: false },
    inventory
  };
  const syntheticReconciliationContract = { ...reconciliationContract, authoritativeArchive: identity };
  const reconciliationPlan = buildReconciliationPlan(inventoryReport, syntheticReconciliationContract);
  return { archiveBuffer, identity, inventoryReport, reconciliationPlan };
}

function expectReject(label, promiseFactory, fragment) {
  return promiseFactory().then(
    () => { throw new Error(`${label}: unsafe extraction was accepted`); },
    (error) => {
      const message = String(error instanceof Error ? error.message : error);
      if (fragment && !message.includes(fragment)) throw new Error(`${label}: wrong rejection: ${message}`);
    }
  );
}

const safeSpecs = [
  { name: "src/App.tsx", data: "export default function App(){return null}\n", method: 8 },
  { name: "content/kandas.json", data: "{\"records\":[]}\n", method: 0 },
  { name: "public/hero.svg", data: "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n", method: 8 }
];
const safe = makeContext(safeSpecs);
const tempRoot = await mkdtemp(join(tmpdir(), "ramaverse-quarantine-test-"));
try {
  const quarantineRoot = join(tempRoot, "quarantine");
  const testContract = {
    ...realExtractionContract,
    authoritativeArchive: safe.identity,
    quarantineRoot,
    extractionAuthorized: true
  };
  const destination = join(quarantineRoot, "run-001");
  const manifest = await extractVerifiedArchiveToQuarantine({
    archiveBuffer: safe.archiveBuffer,
    inventoryReport: safe.inventoryReport,
    reconciliationPlan: safe.reconciliationPlan,
    intakePolicy: intakeContract.zip,
    contract: testContract,
    destination
  });
  if (manifest.extractedFileCount !== 3) throw new Error("synthetic extraction file count mismatch");
  if (manifest.canonicalIntegrationAuthorized !== false || manifest.productionAuthorized !== false) throw new Error("synthetic extraction manifest authorized a downstream operation");
  for (const spec of safeSpecs) {
    const actual = await readFile(join(destination, spec.name), "utf8");
    if (actual !== spec.data) throw new Error(`synthetic extracted payload mismatch: ${spec.name}`);
  }
  const persistedManifest = JSON.parse(await readFile(join(destination, "extraction-manifest.json"), "utf8"));
  if (persistedManifest.files.length !== 3 || persistedManifest.files.some((file) => !/^[a-f0-9]{64}$/.test(file.sha256))) throw new Error("extraction manifest file hashes are incomplete");

  await expectReject("checked-in real authorization", () => extractVerifiedArchiveToQuarantine({
    archiveBuffer: safe.archiveBuffer,
    inventoryReport: safe.inventoryReport,
    reconciliationPlan: safe.reconciliationPlan,
    intakePolicy: intakeContract.zip,
    contract: realExtractionContract,
    destination: join(tempRoot, "must-not-create")
  }), "authorization is not true");
  try { await access(join(tempRoot, "must-not-create")); throw new Error("unauthorized extraction mutated filesystem"); } catch (error) { if (String(error).includes("unauthorized extraction mutated")) throw error; }

  await expectReject("outside quarantine", () => extractVerifiedArchiveToQuarantine({
    archiveBuffer: safe.archiveBuffer,
    inventoryReport: safe.inventoryReport,
    reconciliationPlan: safe.reconciliationPlan,
    intakePolicy: intakeContract.zip,
    contract: testContract,
    destination: join(tempRoot, "outside")
  }), "outside the quarantine root");

  const preexisting = join(quarantineRoot, "preexisting");
  await mkdir(preexisting, { recursive: true });
  await expectReject("preexisting destination", () => extractVerifiedArchiveToQuarantine({
    archiveBuffer: safe.archiveBuffer,
    inventoryReport: safe.inventoryReport,
    reconciliationPlan: safe.reconciliationPlan,
    intakePolicy: intakeContract.zip,
    contract: testContract,
    destination: preexisting
  }), "destination already exists");

  const mismatchReport = JSON.parse(JSON.stringify(safe.inventoryReport));
  mismatchReport.inventory.entries[0].uncompressedSize += 1;
  await expectReject("saved inventory mismatch", () => extractVerifiedArchiveToQuarantine({
    archiveBuffer: safe.archiveBuffer,
    inventoryReport: mismatchReport,
    reconciliationPlan: safe.reconciliationPlan,
    intakePolicy: intakeContract.zip,
    contract: testContract,
    destination: join(quarantineRoot, "mismatch")
  }), "saved/fresh inventory mismatch");

  const blocked = makeContext([{ name: "KirthiVerse/data.json", data: "{}\n", method: 8 }]);
  const blockedContract = { ...testContract, authoritativeArchive: blocked.identity };
  await expectReject("cross-project blocker", () => extractVerifiedArchiveToQuarantine({
    archiveBuffer: blocked.archiveBuffer,
    inventoryReport: blocked.inventoryReport,
    reconciliationPlan: blocked.reconciliationPlan,
    intakePolicy: intakeContract.zip,
    contract: blockedContract,
    destination: join(quarantineRoot, "blocked")
  }), "plan contains blockers");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("QUARANTINE_EXTRACTION_SELFTEST_PASS");
console.log("SYNTHETIC_SAFE_EXTRACTION=PASS");
console.log("FILE_SHA256_MANIFEST=PASS");
console.log("REAL_CHECKED_IN_AUTHORIZATION_REFUSAL=PASS");
console.log("OUT_OF_ROOT_REJECTION=PASS");
console.log("PREEXISTING_DESTINATION_REJECTION=PASS");
console.log("SAVED_FRESH_INVENTORY_MISMATCH_REJECTION=PASS");
console.log("CROSS_PROJECT_BLOCKER_REJECTION=PASS");
console.log("CANONICAL_INTEGRATION_PRODUCTION_AUTHORIZATION=false");
