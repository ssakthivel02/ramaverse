import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

function fail(message) {
  throw new Error(`STAGING_PROMOTION_FAIL: ${message}`);
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeRelativePath(value) {
  if (typeof value !== "string" || !value.length || value.startsWith("/") || /^[A-Za-z]:/.test(value) || value.includes("\\")) fail(`unsafe relative path: ${value}`);
  const parts = value.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) fail(`unsafe relative path: ${value}`);
  return parts.join("/");
}

function validateInputs(manifest, plan, contract) {
  if (contract.promotionAuthorized !== true) fail("checked-in promotion authorization is not true");
  if (contract.canonicalIntegrationAuthorized !== false || contract.productionAuthorized !== false) fail("promotion contract must not authorize canonical integration or production");
  const req = contract.requirements;
  if (req.sourceTreeMutationAllowed !== false || req.publicTreeMutationAllowed !== false || req.canonicalPublicationMutationAllowed !== false || req.mobileVc14MutationAllowed !== false || req.canonicalWinnerSelectionAllowed !== false || req.canonicalRewriteAllowed !== false || req.recordRegenerationAllowed !== false || req.productionMutationAllowed !== false) fail("promotion contract permits a forbidden mutation surface");
  if (manifest?.project !== contract.project || manifest?.mode !== contract.requiredQuarantineMode) fail("quarantine manifest identity/mode mismatch");
  if (manifest?.archive?.name !== contract.authoritativeArchive.name || manifest?.archive?.sha256 !== contract.authoritativeArchive.sha256 || manifest?.archive?.bytes !== contract.authoritativeArchive.bytes) fail("quarantine manifest archive identity mismatch");
  if (manifest?.canonicalIntegrationAuthorized !== false || manifest?.productionAuthorized !== false) fail("quarantine manifest authorized a downstream operation");
  if (plan?.project !== contract.project || plan?.archive?.name !== contract.authoritativeArchive.name || plan?.archive?.sha256 !== contract.authoritativeArchive.sha256 || plan?.archive?.bytes !== contract.authoritativeArchive.bytes) fail("reconciliation plan archive identity mismatch");
  if (manifest?.planSha256 !== plan?.planSha256) fail("quarantine manifest plan SHA-256 does not match reconciliation plan");
  if (plan?.summary?.blockers !== 0 || (plan?.blockers?.length ?? 0) !== 0) fail("reconciliation plan contains blockers");
  if (!Array.isArray(manifest?.files) || !Array.isArray(plan?.decisions)) fail("manifest files or reconciliation decisions missing");
}

export async function promoteQuarantineToReviewStaging({ quarantineDirectory, quarantineManifest, reconciliationPlan, contract, destination }) {
  validateInputs(quarantineManifest, reconciliationPlan, contract);
  const stagingRoot = resolve(contract.stagingRoot);
  const destinationPath = resolve(destination);
  if (destinationPath === stagingRoot || !destinationPath.startsWith(`${stagingRoot}${sep}`)) fail("destination is outside the staging root");
  await mkdir(stagingRoot, { recursive: true });
  const canonicalStagingRoot = await realpath(stagingRoot);
  if (await exists(destinationPath)) fail("destination already exists");
  await mkdir(destinationPath, { recursive: false });
  const canonicalDestination = await realpath(destinationPath);
  if (!canonicalDestination.startsWith(`${canonicalStagingRoot}${sep}`)) fail("resolved destination escapes staging root");

  const quarantineRoot = await realpath(quarantineDirectory);
  const decisionsByPath = new Map(reconciliationPlan.decisions.map((decision) => [decision.path, decision]));
  const allowed = new Set(contract.allowedPromotionActions);
  const never = new Set(contract.neverPromoteActions);
  const promoted = [];
  const skipped = [];

  for (const file of quarantineManifest.files) {
    const relative = safeRelativePath(file.path);
    const decision = decisionsByPath.get(relative);
    if (!decision) fail(`no reconciliation decision for quarantined file: ${relative}`);
    if (decision.blocker === true || never.has(decision.action)) {
      skipped.push({ path: relative, action: decision.action, reason: "non-promotable reconciliation action" });
      continue;
    }
    if (!allowed.has(decision.action) || file.action !== decision.action) fail(`manifest/reconciliation action mismatch: ${relative}`);

    const source = resolve(quarantineRoot, relative);
    if (!source.startsWith(`${quarantineRoot}${sep}`)) fail(`source escapes quarantine root: ${relative}`);
    const payload = await readFile(source);
    const actualHash = sha256(payload);
    if (actualHash !== file.sha256 || payload.length !== file.bytes) fail(`quarantine file integrity mismatch: ${relative}`);

    const output = resolve(destinationPath, relative);
    if (!output.startsWith(`${destinationPath}${sep}`)) fail(`staging output escapes destination: ${relative}`);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(source, output, 1);
    const copied = await readFile(output);
    if (sha256(copied) !== actualHash || (await stat(output)).size !== payload.length) fail(`staging copy integrity mismatch: ${relative}`);
    promoted.push({ path: relative, bytes: payload.length, sha256: actualHash, action: decision.action });
  }

  const core = {
    schemaVersion: 1,
    project: contract.project,
    mode: contract.mode,
    archive: { ...contract.authoritativeArchive },
    quarantinePlanSha256: reconciliationPlan.planSha256,
    sourceQuarantineManifestFileCount: quarantineManifest.extractedFileCount,
    promotedFileCount: promoted.length,
    skippedFileCount: skipped.length,
    canonicalWinnerSelected: false,
    canonicalIntegrationAuthorized: false,
    productionAuthorized: false,
    files: promoted,
    skipped
  };
  const manifest = { ...core, promotionManifestSha256: sha256(Buffer.from(JSON.stringify(core))) };
  await writeFile(resolve(destinationPath, "promotion-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}
