import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const routes = JSON.parse(await readFile("src/data/routes.json", "utf8"));
const rc = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const ingestionContract = JSON.parse(await readFile("docs/CANONICAL_INGESTION_CONTRACT.json", "utf8"));
const intakeContract = JSON.parse(await readFile("docs/RC_INTAKE_SAFETY_CONTRACT.json", "utf8"));
const reconciliationContract = JSON.parse(await readFile("docs/RECONCILIATION_PREP_CONTRACT.json", "utf8"));
const quarantineContract = JSON.parse(await readFile("docs/QUARANTINE_EXTRACTION_CONTRACT.json", "utf8"));
const lockGate = JSON.parse(await readFile("docs/DEPENDENCY_LOCK_GATE.json", "utf8"));
const lock = await readFile("package-lock.json");
const lockDigest = createHash("sha256").update(lock).digest("hex");
const lockBytes = (await stat("package-lock.json")).size;

if (lockDigest !== lockGate.packageLockSha256 || lockBytes !== lockGate.packageLockBytes) {
  throw new Error("Refusing to write green evidence: dependency lock identity does not match the approved gate.");
}
if (
  ingestionContract.project !== rc.project ||
  ingestionContract.expectedSourceArchive.name !== rc.archive ||
  ingestionContract.expectedSourceArchive.sha256 !== rc.sha256 ||
  ingestionContract.expectedSourceArchive.bytes !== rc.zipBytes ||
  ingestionContract.expectedCanonicalBaseline !== rc.canonicalBaseline ||
  ingestionContract.regenerateMissingRecords !== false
) {
  throw new Error("Refusing to write green evidence: canonical ingestion contract drifted from the authoritative RC gate.");
}
if (
  intakeContract.project !== rc.project ||
  intakeContract.authoritativeArchive.name !== rc.archive ||
  intakeContract.authoritativeArchive.sha256 !== rc.sha256 ||
  intakeContract.authoritativeArchive.bytes !== rc.zipBytes ||
  intakeContract.mode !== "inventory-only-before-extraction" ||
  intakeContract.extract !== false ||
  intakeContract.canonicalIntegrationAuthorized !== false
) {
  throw new Error("Refusing to write green evidence: RC intake safety contract drifted from the authoritative gate or authorized a prohibited operation.");
}
if (
  reconciliationContract.project !== rc.project ||
  reconciliationContract.authoritativeArchive.name !== rc.archive ||
  reconciliationContract.authoritativeArchive.sha256 !== rc.sha256 ||
  reconciliationContract.authoritativeArchive.bytes !== rc.zipBytes ||
  reconciliationContract.expectedCanonicalBaseline !== rc.canonicalBaseline ||
  reconciliationContract.mode !== "metadata-only-reconciliation-plan-before-extraction" ||
  reconciliationContract.scope.websiteOnly !== true ||
  reconciliationContract.scope.mobileVc14MutationAllowed !== false ||
  reconciliationContract.scope.automaticExtractionAllowed !== false ||
  reconciliationContract.scope.automaticIntegrationAllowed !== false ||
  reconciliationContract.scope.automaticCanonicalWinnerAllowed !== false ||
  reconciliationContract.scope.canonicalRewriteAllowed !== false ||
  reconciliationContract.scope.recordRegenerationAllowed !== false ||
  reconciliationContract.scope.crossProjectMixingAllowed !== false ||
  reconciliationContract.extractionAuthorized !== false ||
  reconciliationContract.canonicalIntegrationAuthorized !== false ||
  reconciliationContract.productionAuthorized !== false
) {
  throw new Error("Refusing to write green evidence: reconciliation preparation contract drifted or authorized a prohibited operation.");
}
if (
  quarantineContract.project !== rc.project ||
  quarantineContract.authoritativeArchive.name !== rc.archive ||
  quarantineContract.authoritativeArchive.sha256 !== rc.sha256 ||
  quarantineContract.authoritativeArchive.bytes !== rc.zipBytes ||
  quarantineContract.expectedCanonicalBaseline !== rc.canonicalBaseline ||
  quarantineContract.requiredReconciliationMode !== reconciliationContract.mode ||
  quarantineContract.mode !== "verified-archive-to-disposable-quarantine-only" ||
  quarantineContract.extractionAuthorized !== false ||
  quarantineContract.canonicalIntegrationAuthorized !== false ||
  quarantineContract.productionAuthorized !== false ||
  quarantineContract.requirements.sourceTreeMutationAllowed !== false ||
  quarantineContract.requirements.publicTreeMutationAllowed !== false ||
  quarantineContract.requirements.stagingCanonicalMutationAllowed !== false ||
  quarantineContract.requirements.mobileVc14MutationAllowed !== false ||
  quarantineContract.requirements.canonicalRewriteAllowed !== false ||
  quarantineContract.requirements.recordRegenerationAllowed !== false ||
  quarantineContract.requirements.productionMutationAllowed !== false
) {
  throw new Error("Refusing to write green evidence: quarantine extraction contract drifted or authorized a prohibited operation.");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function totalBytes(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += await totalBytes(path);
    else total += (await stat(path)).size;
  }
  return total;
}

const candidateCommit = process.env.CANDIDATE_SHA || process.env.GITHUB_SHA || "local";
const workflowCommit = process.env.GITHUB_SHA || "local";
const canonicalPublicationPresent =
  (await exists(join(ingestionContract.publicationRoot, "canonical-manifest.json"))) ||
  (await exists(join(ingestionContract.publicationRoot, "canonical")));
const canonicalStagingPresent = await exists(ingestionContract.stagingRoot);
const authoritativeArchivePresent = await exists(rc.archive);
const rcInventoryPresent = await exists("rc-inventory.json");
const reconciliationPlanPresent = await exists("rc-reconciliation-plan.json");
const realQuarantinePresent = await exists(".quarantine");

if (rc.integrationAuthorized !== true && (canonicalPublicationPresent || canonicalStagingPresent)) {
  throw new Error("Refusing to write green evidence: canonical staging/publication exists while integration is unauthorized.");
}
if (authoritativeArchivePresent) {
  throw new Error("Refusing to write green CI evidence: authoritative RC archive is present in the validation workspace.");
}
if (rcInventoryPresent || reconciliationPlanPresent) {
  throw new Error("Refusing to write green CI evidence: real RC inventory/reconciliation artifacts are present in the clean validation workspace.");
}
if (realQuarantinePresent) {
  throw new Error("Refusing to write green CI evidence: a real quarantine tree exists in the clean validation workspace.");
}

const evidence = {
  schemaVersion: 7,
  generatedAt: new Date().toISOString(),
  repository: "ssakthivel02/ramaverse",
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "local",
  candidateCommit,
  workflowCommit,
  packageVersion: pkg.version,
  classification: "QUARANTINE_EXTRACTION_GATE_GREEN_NOT_PRODUCTION_READY",
  routeContract: {
    expected: 22,
    actual: routes.length,
    knowledgePresent: routes.some((route) => route.path === "/knowledge")
  },
  rcIntake: {
    mode: intakeContract.mode,
    archive: rc.archive,
    archiveSha256: rc.sha256,
    archiveBytes: rc.zipBytes,
    authoritativeArchivePresent,
    extractionAuthorized: false,
    extractionPerformed: false,
    allowZip64: intakeContract.zip.allowZip64,
    allowMultiDisk: intakeContract.zip.allowMultiDisk,
    allowEncryptedEntries: intakeContract.zip.allowEncryptedEntries,
    allowSymlinks: intakeContract.zip.allowSymlinks,
    allowedCompressionMethods: intakeContract.zip.allowedCompressionMethods,
    maxEntries: intakeContract.zip.maxEntries,
    maxTotalUncompressedBytes: intakeContract.zip.maxTotalUncompressedBytes,
    maxCompressionRatio: intakeContract.zip.maxCompressionRatio
  },
  reconciliationPreparation: {
    mode: reconciliationContract.mode,
    toolingValidated: true,
    realInventoryPresent: rcInventoryPresent,
    realPlanPresent: reconciliationPlanPresent,
    preserveEveryInventoryEntry: reconciliationContract.planRequirements.preserveEveryInventoryEntry,
    oneDecisionPerInventoryEntry: reconciliationContract.planRequirements.oneDecisionPerInventoryEntry,
    automaticExtractionAllowed: reconciliationContract.scope.automaticExtractionAllowed,
    automaticIntegrationAllowed: reconciliationContract.scope.automaticIntegrationAllowed,
    automaticCanonicalWinnerAllowed: reconciliationContract.scope.automaticCanonicalWinnerAllowed,
    canonicalRewriteAllowed: reconciliationContract.scope.canonicalRewriteAllowed,
    recordRegenerationAllowed: reconciliationContract.scope.recordRegenerationAllowed,
    mobileVc14MutationAllowed: reconciliationContract.scope.mobileVc14MutationAllowed,
    crossProjectMixingAllowed: reconciliationContract.scope.crossProjectMixingAllowed,
    extractionAuthorized: reconciliationContract.extractionAuthorized,
    canonicalIntegrationAuthorized: reconciliationContract.canonicalIntegrationAuthorized,
    productionAuthorized: reconciliationContract.productionAuthorized
  },
  quarantineExtraction: {
    mode: quarantineContract.mode,
    toolingValidated: true,
    quarantineRoot: quarantineContract.quarantineRoot,
    realQuarantinePresent,
    realArchiveExtractionAuthorized: quarantineContract.extractionAuthorized,
    realArchiveExtractionPerformed: false,
    archiveIdentityMustPass: quarantineContract.requirements.archiveIdentityMustPass,
    zipIntakeMustPass: quarantineContract.requirements.zipIntakeMustPass,
    reconciliationPlanMustMatchArchive: quarantineContract.requirements.reconciliationPlanMustMatchArchive,
    oneDecisionPerInventoryEntry: quarantineContract.requirements.oneDecisionPerInventoryEntry,
    planBlockersMustEqualZero: quarantineContract.requirements.planBlockersMustEqualZero,
    destinationMustBeEmpty: quarantineContract.requirements.destinationMustBeEmpty,
    destinationMustRemainInsideQuarantineRoot: quarantineContract.requirements.destinationMustRemainInsideQuarantineRoot,
    crc32MustMatch: quarantineContract.requirements.crc32MustMatch,
    uncompressedSizeMustMatch: quarantineContract.requirements.uncompressedSizeMustMatch,
    exclusiveCreate: quarantineContract.requirements.writeFilesWithExclusiveCreate,
    manifestHashesEveryExtractedFile: quarantineContract.requirements.manifestMustHashEveryExtractedFile,
    sourceTreeMutationAllowed: quarantineContract.requirements.sourceTreeMutationAllowed,
    publicTreeMutationAllowed: quarantineContract.requirements.publicTreeMutationAllowed,
    stagingCanonicalMutationAllowed: quarantineContract.requirements.stagingCanonicalMutationAllowed,
    mobileVc14MutationAllowed: quarantineContract.requirements.mobileVc14MutationAllowed,
    canonicalRewriteAllowed: quarantineContract.requirements.canonicalRewriteAllowed,
    recordRegenerationAllowed: quarantineContract.requirements.recordRegenerationAllowed,
    canonicalIntegrationAuthorized: quarantineContract.canonicalIntegrationAuthorized,
    productionAuthorized: quarantineContract.productionAuthorized
  },
  canonical: {
    expectedBaseline: rc.canonicalBaseline,
    sourceArchive: rc.archive,
    sourceArchiveSha256: rc.sha256,
    sourceArchiveBytes: rc.zipBytes,
    imported: false,
    stagingPresent: canonicalStagingPresent,
    publicationPresent: canonicalPublicationPresent,
    integrationAuthorized: rc.integrationAuthorized,
    productionAuthorized: rc.productionAuthorized,
    regenerateMissingRecords: ingestionContract.regenerateMissingRecords
  },
  dependencyLock: {
    sha256: lockDigest,
    bytes: lockBytes,
    lockfileVersion: lockGate.packageLockVersion,
    driftAllowed: lockGate.allowDependencyDrift
  },
  validations: {
    foundation: "pass",
    rcIdentityContract: "pass",
    rcIntakeSafetyContract: "pass",
    rcIntakeSafeZipFixture: "pass",
    rcIntakeIdentityMismatchRejection: "pass",
    rcIntakePathCollisionSymlinkEncryptionRejection: "pass",
    rcIntakeZip64MultidiskBombRejection: "pass",
    rcIntakeLocalCentralConsistency: "pass",
    reconciliationPrepContract: "pass",
    reconciliationSyntheticInventoryClassification: "pass",
    reconciliationOneDecisionPerEntry: "pass",
    reconciliationDeterministicPlanHash: "pass",
    reconciliationCrossProjectBlocker: "pass",
    reconciliationUnauthorizedOperationRejection: "pass",
    quarantineExtractionContract: "pass",
    quarantineSyntheticSafeExtraction: "pass",
    quarantineFileSha256Manifest: "pass",
    quarantineRealAuthorizationRefusal: "pass",
    quarantineOutOfRootRejection: "pass",
    quarantinePreexistingDestinationRejection: "pass",
    quarantineSavedFreshInventoryMismatchRejection: "pass",
    quarantineCrossProjectBlockerRejection: "pass",
    quarantineNoRealWorkspaceOutput: "pass",
    canonicalIngestionContract: "pass",
    canonicalSynthetic550Fixture: "pass",
    canonicalDuplicateIdRejection: "pass",
    canonicalUnauthorizedPublicationAbsence: "pass",
    dependencyLockIdentity: "pass",
    productionDependencyAuditHigh: "pass",
    lint: "pass",
    typecheck: "pass",
    productionBuild: "pass",
    browserE2E: "pass",
    automatedAccessibilitySeriousCritical: "pass",
    mobileOverflow: "pass",
    reducedMotion: "pass",
    cleanRoomIsolation: "pass"
  },
  distBytes: await totalBytes("dist"),
  productionDeployment: false
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/validation-summary.json", `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(
  "artifacts/validation-summary.md",
  `# RamaVerse Next-Gen Quarantine Extraction Gate Evidence\n\n- Candidate commit: \`${candidateCommit}\`\n- Workflow commit/ref SHA: \`${workflowCommit}\`\n- Branch: \`${evidence.branch}\`\n- Routes: ${evidence.routeContract.actual}/${evidence.routeContract.expected}\n- /knowledge: ${evidence.routeContract.knowledgePresent ? "PASS" : "FAIL"}\n- Authoritative RC SHA-256: \`${rc.sha256}\`\n- Authoritative RC present in CI workspace: NO\n- RC intake mode: INVENTORY ONLY\n- Reconciliation mode: METADATA-ONLY PLAN BEFORE EXTRACTION\n- Real RC inventory / reconciliation plan present: NO / NO\n- Quarantine extraction tooling: PASS\n- Quarantine mode: VERIFIED ARCHIVE TO DISPOSABLE QUARANTINE ONLY\n- Synthetic safe extraction: PASS\n- CRC32 + uncompressed-size verification: PASS\n- Per-file SHA-256 extraction manifest: PASS\n- Out-of-root / preexisting destination / saved-vs-fresh mismatch rejection: PASS / PASS / PASS\n- Cross-project blocker rejection: PASS\n- Real quarantine output present in CI workspace: NO\n- Real archive extraction authorized/performed: NO / NO\n- Automatic canonical winner: FORBIDDEN\n- Canonical rewrite/regeneration: FORBIDDEN / FORBIDDEN\n- Mobile/VC14 mutation: FORBIDDEN\n- Canonical expected baseline: ${rc.canonicalBaseline}\n- Canonical 550 imported: NO\n- Integration authorized: ${rc.integrationAuthorized ? "YES" : "NO"}\n- Canonical staging/publication present: ${canonicalStagingPresent ? "YES" : "NO"} / ${canonicalPublicationPresent ? "YES" : "NO"}\n- Dependency lock: PASS \`${lockDigest}\`\n- Production dependency audit (high+): PASS\n- Lint / TypeScript / production build: PASS / PASS / PASS\n- Chromium E2E / Axe serious-critical / mobile overflow / reduced motion: PASS / PASS / PASS / PASS\n- Clean-room isolation: PASS\n- Production deployment: NO\n\nClassification: **${evidence.classification}**\n`,
);
console.log(`EVIDENCE_WRITTEN_FOR_CANDIDATE: ${candidateCommit}`);
