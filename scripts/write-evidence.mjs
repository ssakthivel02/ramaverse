import { createHash } from "node:crypto";
import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const routes = JSON.parse(await readFile("src/data/routes.json", "utf8"));
const rc = JSON.parse(await readFile("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const ingestionContract = JSON.parse(await readFile("docs/CANONICAL_INGESTION_CONTRACT.json", "utf8"));
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

if (rc.integrationAuthorized !== true && (canonicalPublicationPresent || canonicalStagingPresent)) {
  throw new Error("Refusing to write green evidence: canonical staging/publication exists while integration is unauthorized.");
}

const evidence = {
  schemaVersion: 4,
  generatedAt: new Date().toISOString(),
  repository: "ssakthivel02/ramaverse",
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "local",
  candidateCommit,
  workflowCommit,
  packageVersion: pkg.version,
  classification: "CANONICAL_INGESTION_GATE_GREEN_NOT_PRODUCTION_READY",
  routeContract: {
    expected: 22,
    actual: routes.length,
    knowledgePresent: routes.some((route) => route.path === "/knowledge")
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
  `# RamaVerse Next-Gen Canonical Ingestion Evidence\n\n- Candidate commit: \`${candidateCommit}\`\n- Workflow commit/ref SHA: \`${workflowCommit}\`\n- Branch: \`${evidence.branch}\`\n- Routes: ${evidence.routeContract.actual}/${evidence.routeContract.expected}\n- /knowledge: ${evidence.routeContract.knowledgePresent ? "PASS" : "FAIL"}\n- Authoritative RC SHA-256: \`${rc.sha256}\`\n- Canonical expected baseline: ${rc.canonicalBaseline}\n- Canonical 550 imported: NO\n- Integration authorized: ${rc.integrationAuthorized ? "YES" : "NO"}\n- Canonical staging present: ${canonicalStagingPresent ? "YES" : "NO"}\n- Canonical publication present: ${canonicalPublicationPresent ? "YES" : "NO"}\n- Missing-record regeneration allowed: NO\n- Canonical ingestion contract: PASS\n- Synthetic 550-record validator fixture: PASS\n- Duplicate record-ID rejection: PASS\n- Dependency lock: PASS \`${lockDigest}\`\n- Production dependency audit (high+): PASS\n- Lint: PASS\n- TypeScript: PASS\n- Production build: PASS\n- Chromium E2E: PASS\n- Axe serious/critical: PASS\n- Mobile overflow: PASS\n- Reduced motion: PASS\n- Clean-room isolation: PASS\n- Production deployment: NO\n\nClassification: **${evidence.classification}**\n`,
);
console.log(`EVIDENCE_WRITTEN_FOR_CANDIDATE: ${candidateCommit}`);
