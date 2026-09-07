import { readFile } from "node:fs/promises";
import { buildReconciliationPlan } from "./lib/reconciliation-plan.mjs";

const contract = JSON.parse(await readFile("docs/RECONCILIATION_PREP_CONTRACT.json", "utf8"));

function entry(name, overrides = {}) {
  return {
    index: 1,
    name,
    directory: name.endsWith("/"),
    flags: 2048,
    compressionMethod: 8,
    crc32: "1234abcd",
    compressedSize: 100,
    uncompressedSize: 200,
    compressionRatio: 2,
    localHeaderOffset: 0,
    unixMode: "100644",
    ...overrides
  };
}

const entries = [
  entry("src/App.tsx"),
  entry("content/kandas.json"),
  entry("README.md"),
  entry("public/hero.webp"),
  entry("mobile/App.tsx"),
  entry("dist/index.js"),
  entry("private/upload.key"),
  entry("tools/deploy.sh"),
  entry("KirthiVerse/data.json"),
  entry("misc/archive.bin"),
  entry("collections/", { directory: true, compressedSize: 0, uncompressedSize: 0, compressionRatio: 0, crc32: "00000000", compressionMethod: 0, unixMode: "040755" })
];
entries.forEach((item, index) => { item.index = index + 1; item.localHeaderOffset = index * 1000; });

function inventoryReport(customEntries = entries) {
  return {
    schemaVersion: 1,
    project: "RamaVerse",
    archive: {
      name: contract.authoritativeArchive.name,
      bytes: contract.authoritativeArchive.bytes,
      sha256: contract.authoritativeArchive.sha256,
      identityChecks: { fileName: true, byteSize: true, sha256: true }
    },
    policy: {
      mode: "inventory-only-before-extraction",
      extract: false,
      integrationAuthorized: false,
      productionAuthorized: false
    },
    inventory: {
      zipFormat: "standard-non-zip64",
      entryCount: customEntries.length,
      centralDirectoryOffset: 2000,
      centralDirectoryBytes: 1000,
      totalCompressedBytes: customEntries.reduce((sum, item) => sum + item.compressedSize, 0),
      totalUncompressedBytes: customEntries.reduce((sum, item) => sum + item.uncompressedSize, 0),
      aggregateCompressionRatio: 2,
      entries: customEntries
    }
  };
}

const plan = buildReconciliationPlan(inventoryReport(), contract);
const planAgain = buildReconciliationPlan(inventoryReport(), contract);
if (plan.planSha256 !== planAgain.planSha256) throw new Error("reconciliation plan is not deterministic");
if (plan.inventoryEntryCount !== entries.length || plan.decisions.length !== entries.length) throw new Error("reconciliation plan omitted inventory entries");
if (Object.values(plan.summary.counts).reduce((sum, value) => sum + value, 0) !== entries.length) throw new Error("reconciliation action counts do not cover every inventory entry");

const expectedActions = new Map([
  ["src/App.tsx", "review-website-source"],
  ["content/kandas.json", "review-canonical-candidate"],
  ["README.md", "review-documentation"],
  ["public/hero.webp", "review-asset"],
  ["mobile/App.tsx", "quarantine-mobile-vc14"],
  ["dist/index.js", "quarantine-generated-cache"],
  ["private/upload.key", "quarantine-secret-like"],
  ["tools/deploy.sh", "quarantine-executable"],
  ["KirthiVerse/data.json", "reject-cross-project"],
  ["misc/archive.bin", "review-unknown"],
  ["collections/", "directory-metadata-only"]
]);
for (const decision of plan.decisions) {
  const expected = expectedActions.get(decision.path);
  if (decision.action !== expected) throw new Error(`${decision.path}: expected ${expected}, received ${decision.action}`);
  if (decision.extractionAuthorized !== false || decision.integrationAuthorized !== false) throw new Error(`${decision.path}: planner authorized a forbidden action`);
}
if (plan.summary.blockers !== 1 || plan.blockers[0]?.path !== "KirthiVerse/data.json") throw new Error("cross-project blocker was not surfaced exactly once");
if (plan.summary.automaticExtractionAllowed !== false || plan.summary.automaticIntegrationAllowed !== false || plan.summary.automaticCanonicalWinnerAllowed !== false || plan.summary.recordRegenerationAllowed !== false || plan.summary.productionAuthorized !== false) throw new Error("plan summary weakened a hard-stop control");

function expectReject(label, factory, fragment) {
  try {
    factory();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (!message.includes(fragment)) throw new Error(`${label}: wrong rejection: ${message}`);
    return;
  }
  throw new Error(`${label}: invalid input was accepted`);
}

expectReject("archive hash drift", () => buildReconciliationPlan({ ...inventoryReport(), archive: { ...inventoryReport().archive, sha256: "0".repeat(64) } }, contract), "archive SHA-256 mismatch");
expectReject("identity check drift", () => buildReconciliationPlan({ ...inventoryReport(), archive: { ...inventoryReport().archive, identityChecks: { fileName: true, byteSize: true, sha256: false } } }, contract), "identity checks are not all true");
expectReject("extraction drift", () => buildReconciliationPlan({ ...inventoryReport(), policy: { ...inventoryReport().policy, extract: true } }, contract), "extraction=false");
expectReject("integration drift", () => buildReconciliationPlan({ ...inventoryReport(), policy: { ...inventoryReport().policy, integrationAuthorized: true } }, contract), "authorizes integration");
expectReject("case collision", () => buildReconciliationPlan(inventoryReport([entry("A.txt"), entry("a.txt")]), contract), "duplicate/case-colliding inventory path");
expectReject("path traversal", () => buildReconciliationPlan(inventoryReport([entry("../escape.txt")]), contract), "non-canonical inventory path");
expectReject("entry count mismatch", () => buildReconciliationPlan({ ...inventoryReport(), inventory: { ...inventoryReport().inventory, entryCount: 99 } }, contract), "entryCount does not match");
expectReject("contract extraction drift", () => buildReconciliationPlan(inventoryReport(), { ...contract, extractionAuthorized: true }), "extraction must remain unauthorized");
expectReject("canonical regeneration drift", () => buildReconciliationPlan(inventoryReport(), { ...contract, scope: { ...contract.scope, recordRegenerationAllowed: true } }), "canonical rewrite/regeneration must remain forbidden");

console.log("RECONCILIATION_PREP_SELFTEST_PASS");
console.log(`SYNTHETIC_INVENTORY_ENTRIES=${entries.length}`);
console.log("ONE_DECISION_PER_ENTRY=PASS");
console.log("DETERMINISTIC_PLAN_SHA256=PASS");
console.log("CROSS_PROJECT_BLOCKER=PASS");
console.log("MOBILE_GENERATED_SECRET_EXECUTABLE_QUARANTINE=PASS");
console.log("CANONICAL_SOURCE_DOC_ASSET_UNKNOWN_CLASSIFICATION=PASS");
console.log("UNAUTHORIZED_EXTRACTION_INTEGRATION_REGENERATION_REJECTION=PASS");
