import { extname, posix } from "node:path";
import { sha256, stableStringify } from "./canonical-ingestion.mjs";

function fail(message) {
  throw new Error(`RECONCILIATION_PREP_FAIL: ${message}`);
}

function lowerSet(values) {
  return new Set(values.map((value) => String(value).toLowerCase()));
}

function normalizeInventoryPath(value) {
  if (typeof value !== "string" || !value.length) fail("inventory entry path is missing");
  if (value.includes("\\") || value.startsWith("/") || /^[A-Za-z]:/.test(value)) fail(`unsafe inventory path: ${value}`);
  const normalized = posix.normalize(value);
  if (normalized !== value || normalized === ".." || normalized.startsWith("../")) fail(`non-canonical inventory path: ${value}`);
  return value;
}

function pathParts(path) {
  return path.split("/").filter(Boolean);
}

function includesSegment(parts, candidates) {
  return parts.some((part) => candidates.has(part.toLowerCase()));
}

function includesSignal(path, signals) {
  const lower = path.toLowerCase();
  return signals.some((signal) => lower.includes(signal.toLowerCase()));
}

function classifyEntry(entry, contract) {
  const path = normalizeInventoryPath(entry.name);
  const parts = pathParts(path);
  const lowerParts = parts.map((part) => part.toLowerCase());
  const basename = lowerParts.at(-1) ?? "";
  const extension = extname(basename).toLowerCase();
  const classification = contract.classification;

  const generatedSegments = lowerSet(classification.generatedOrCacheSegments);
  const mobileSegments = lowerSet(classification.mobileOutOfScopeSegments);
  const canonicalExtensions = lowerSet(classification.canonicalCandidateExtensions);
  const documentationExtensions = lowerSet(classification.documentationExtensions);
  const assetExtensions = lowerSet(classification.assetExtensions);
  const sourceExtensions = lowerSet(classification.websiteSourceExtensions);
  const secretExtensions = lowerSet(classification.secretLikeExtensions);
  const executableExtensions = lowerSet(classification.executableExtensions);
  const secretNames = lowerSet(classification.secretLikeNames);

  const crossProject = classification.crossProjectSignals.find((signal) => path.toLowerCase().includes(signal.toLowerCase()));
  if (crossProject) {
    return { action: "reject-cross-project", reason: `cross-project signal detected: ${crossProject}`, blocker: true };
  }

  if (secretExtensions.has(extension) || secretNames.has(basename) || basename === ".env" || basename.startsWith(".env.")) {
    return { action: "quarantine-secret-like", reason: "secret-like path or extension", blocker: false };
  }

  if (executableExtensions.has(extension)) {
    return { action: "quarantine-executable", reason: "executable/script file requires separate security review", blocker: false };
  }

  if (includesSegment(lowerParts, mobileSegments)) {
    return { action: "quarantine-mobile-vc14", reason: "outside website-only recovery scope", blocker: false };
  }

  if (includesSegment(lowerParts, generatedSegments)) {
    return { action: "quarantine-generated-cache", reason: "generated/cache dependency tree is not a recovery source", blocker: false };
  }

  if (entry.directory === true || path.endsWith("/")) {
    return { action: "directory-metadata-only", reason: "directory inventory metadata", blocker: false };
  }

  const canonicalSignal = includesSignal(path, classification.canonicalSignalSegments);
  if (canonicalSignal && canonicalExtensions.has(extension)) {
    return { action: "review-canonical-candidate", reason: "path/extension may contain canonical or editorial corpus data; authority not implied", blocker: false };
  }

  if (documentationExtensions.has(extension)) {
    return { action: "review-documentation", reason: "documentation/evidence candidate", blocker: false };
  }

  if (assetExtensions.has(extension)) {
    return { action: "review-asset", reason: "media/font/image asset candidate; rights/provenance review required", blocker: false };
  }

  if (sourceExtensions.has(extension)) {
    return { action: "review-website-source", reason: "editable website/source candidate", blocker: false };
  }

  return { action: "review-unknown", reason: "unclassified archive entry requires manual disposition", blocker: false };
}

export function validateReconciliationInput(report, contract) {
  if (!report || typeof report !== "object") fail("inventory report must be an object");
  if (report.schemaVersion !== contract.input.requiredInventorySchemaVersion) fail("inventory schemaVersion mismatch");
  if (report.project !== contract.project) fail("inventory project mismatch");

  const expected = contract.authoritativeArchive;
  if (report.archive?.name !== expected.name) fail("inventory archive name mismatch");
  if (report.archive?.sha256 !== expected.sha256) fail("inventory archive SHA-256 mismatch");
  if (report.archive?.bytes !== expected.bytes) fail("inventory archive byte size mismatch");

  if (contract.input.requireArchiveIdentityChecks) {
    const checks = report.archive?.identityChecks;
    if (!checks || checks.fileName !== true || checks.byteSize !== true || checks.sha256 !== true) fail("archive identity checks are not all true");
  }

  if (contract.input.requireInventoryOnlyPolicy && report.policy?.mode !== "inventory-only-before-extraction") fail("inventory policy is not inventory-only");
  if (contract.input.requireExtractionFalse && report.policy?.extract !== false) fail("inventory report does not prove extraction=false");
  if (contract.input.requireIntegrationFalse && report.policy?.integrationAuthorized !== false) fail("inventory report unexpectedly authorizes integration");
  if (contract.input.requireProductionFalse && report.policy?.productionAuthorized !== false) fail("inventory report unexpectedly authorizes production");

  if (!report.inventory || typeof report.inventory !== "object" || !Array.isArray(report.inventory.entries)) fail("inventory entries are missing");
  if (report.inventory.entryCount !== report.inventory.entries.length) fail("inventory entryCount does not match entries length");

  const seen = new Set();
  for (const entry of report.inventory.entries) {
    const path = normalizeInventoryPath(entry?.name);
    const folded = path.toLowerCase();
    if (seen.has(folded)) fail(`duplicate/case-colliding inventory path: ${path}`);
    seen.add(folded);
  }
}

export function buildReconciliationPlan(report, contract) {
  validateReconciliationInput(report, contract);

  if (contract.scope.websiteOnly !== true) fail("contract must remain website-only");
  if (contract.scope.mobileVc14MutationAllowed !== false) fail("Mobile/VC14 mutation must remain forbidden");
  if (contract.scope.automaticExtractionAllowed !== false || contract.extractionAuthorized !== false) fail("extraction must remain unauthorized");
  if (contract.scope.automaticIntegrationAllowed !== false || contract.canonicalIntegrationAuthorized !== false) fail("canonical integration must remain unauthorized");
  if (contract.scope.automaticCanonicalWinnerAllowed !== false) fail("automatic canonical winner must remain forbidden");
  if (contract.scope.canonicalRewriteAllowed !== false || contract.scope.recordRegenerationAllowed !== false) fail("canonical rewrite/regeneration must remain forbidden");
  if (contract.scope.crossProjectMixingAllowed !== false) fail("cross-project mixing must remain forbidden");
  if (contract.productionAuthorized !== false) fail("production must remain unauthorized");

  const decisions = report.inventory.entries.map((entry, index) => {
    const classification = classifyEntry(entry, contract);
    return {
      inventoryIndex: index + 1,
      path: entry.name,
      directory: entry.directory === true,
      compressedSize: entry.compressedSize,
      uncompressedSize: entry.uncompressedSize,
      crc32: entry.crc32,
      compressionMethod: entry.compressionMethod,
      action: classification.action,
      reason: classification.reason,
      blocker: classification.blocker,
      extractionAuthorized: false,
      integrationAuthorized: false
    };
  });

  if (decisions.length !== report.inventory.entries.length) fail("planner omitted inventory entries");
  const allowedActions = new Set(contract.actions);
  for (const decision of decisions) {
    if (!allowedActions.has(decision.action)) fail(`planner emitted unsupported action: ${decision.action}`);
  }

  const counts = Object.fromEntries(contract.actions.map((action) => [action, 0]));
  for (const decision of decisions) counts[decision.action] += 1;
  const blockers = decisions.filter((decision) => decision.blocker).map((decision) => ({ path: decision.path, action: decision.action, reason: decision.reason }));

  const core = {
    schemaVersion: contract.schemaVersion,
    project: contract.project,
    mode: contract.mode,
    archive: {
      name: report.archive.name,
      sha256: report.archive.sha256,
      bytes: report.archive.bytes
    },
    expectedCanonicalBaseline: contract.expectedCanonicalBaseline,
    inventoryEntryCount: report.inventory.entries.length,
    summary: {
      counts,
      blockers: blockers.length,
      automaticExtractionAllowed: false,
      automaticIntegrationAllowed: false,
      automaticCanonicalWinnerAllowed: false,
      recordRegenerationAllowed: false,
      productionAuthorized: false
    },
    blockers,
    decisions
  };

  return {
    ...core,
    planSha256: sha256(stableStringify(core))
  };
}
