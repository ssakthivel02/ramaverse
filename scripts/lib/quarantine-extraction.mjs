import { createHash } from "node:crypto";
import { access, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { inflateRawSync } from "node:zlib";
import { inspectZipBuffer } from "./zip-intake.mjs";

function fail(message) {
  throw new Error(`QUARANTINE_EXTRACTION_FAIL: ${message}`);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeArchivePath(name) {
  if (typeof name !== "string" || !name.length) fail("archive path missing");
  if (name.startsWith("/") || /^[A-Za-z]:/.test(name) || name.includes("\\")) fail(`unsafe archive path: ${name}`);
  const parts = name.split("/").filter(Boolean);
  if (!parts.length || parts.some((part) => part === "." || part === "..")) fail(`unsafe archive path: ${name}`);
  return parts.join("/") + (name.endsWith("/") ? "/" : "");
}

function compareInventory(expected, actual) {
  if (expected.entryCount !== actual.entryCount) fail("saved inventory entry count differs from fresh ZIP inventory");
  if (expected.entries.length !== actual.entries.length) fail("saved inventory entry list length differs from fresh ZIP inventory");
  for (let index = 0; index < actual.entries.length; index += 1) {
    const a = expected.entries[index];
    const b = actual.entries[index];
    for (const key of ["name", "directory", "compressionMethod", "crc32", "compressedSize", "uncompressedSize", "localHeaderOffset"]) {
      if (a?.[key] !== b?.[key]) fail(`saved/fresh inventory mismatch at entry ${index + 1}: ${key}`);
    }
  }
}

function validatePlan(report, plan, contract) {
  if (plan?.project !== contract.project) fail("reconciliation plan project mismatch");
  if (plan?.mode !== contract.requiredReconciliationMode) fail("reconciliation plan mode mismatch");
  if (plan?.archive?.name !== report.archive.name || plan?.archive?.sha256 !== report.archive.sha256 || plan?.archive?.bytes !== report.archive.bytes) fail("reconciliation plan archive identity mismatch");
  if (plan?.inventoryEntryCount !== report.inventory.entryCount || !Array.isArray(plan?.decisions) || plan.decisions.length !== report.inventory.entryCount) fail("reconciliation plan does not cover every inventory entry");
  if (contract.requirements.planBlockersMustEqualZero && (plan?.summary?.blockers !== 0 || (plan?.blockers?.length ?? 0) !== 0)) fail("reconciliation plan contains blockers");

  const allowed = new Set(contract.allowedPlanActions);
  const blocked = new Set(contract.blockedPlanActions);
  for (let index = 0; index < report.inventory.entries.length; index += 1) {
    const entry = report.inventory.entries[index];
    const decision = plan.decisions[index];
    if (decision?.inventoryIndex !== index + 1 || decision?.path !== entry.name) fail(`reconciliation decision mismatch at inventory entry ${index + 1}`);
    if (decision?.extractionAuthorized !== false || decision?.integrationAuthorized !== false) fail(`reconciliation decision already authorized a prohibited operation: ${entry.name}`);
    if (blocked.has(decision?.action)) fail(`blocked reconciliation action present: ${decision.action}`);
    if (!allowed.has(decision?.action)) fail(`unsupported reconciliation action: ${decision?.action ?? "<missing>"}`);
  }
}

function readEntryPayload(archiveBuffer, entry) {
  const offset = entry.localHeaderOffset;
  if (offset < 0 || offset + 30 > archiveBuffer.length || archiveBuffer.readUInt32LE(offset) !== 0x04034b50) fail(`invalid local header: ${entry.name}`);
  const flags = archiveBuffer.readUInt16LE(offset + 6);
  const method = archiveBuffer.readUInt16LE(offset + 8);
  const nameLength = archiveBuffer.readUInt16LE(offset + 26);
  const extraLength = archiveBuffer.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  const dataStart = nameStart + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > archiveBuffer.length) fail(`compressed data escapes archive: ${entry.name}`);
  const localName = archiveBuffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
  if (localName !== entry.name) fail(`local entry name changed after intake: ${entry.name}`);
  if (method !== entry.compressionMethod) fail(`local compression method changed after intake: ${entry.name}`);
  if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) fail(`encrypted entry reached extractor: ${entry.name}`);

  const compressed = archiveBuffer.subarray(dataStart, dataEnd);
  let payload;
  if (method === 0) payload = Buffer.from(compressed);
  else if (method === 8) payload = inflateRawSync(compressed);
  else fail(`unsupported extraction compression method ${method}: ${entry.name}`);

  if (payload.length !== entry.uncompressedSize) fail(`uncompressed size mismatch: ${entry.name}`);
  const actualCrc = crc32(payload).toString(16).padStart(8, "0");
  if (actualCrc !== entry.crc32) fail(`CRC32 mismatch: ${entry.name}`);
  return payload;
}

export async function extractVerifiedArchiveToQuarantine({ archiveBuffer, inventoryReport, reconciliationPlan, intakePolicy, contract, destination }) {
  if (contract.extractionAuthorized !== true) fail("checked-in extraction authorization is not true");
  if (contract.canonicalIntegrationAuthorized !== false || contract.productionAuthorized !== false) fail("extraction contract must not authorize integration or production");
  if (contract.requirements.sourceTreeMutationAllowed !== false || contract.requirements.publicTreeMutationAllowed !== false || contract.requirements.stagingCanonicalMutationAllowed !== false || contract.requirements.mobileVc14MutationAllowed !== false || contract.requirements.productionMutationAllowed !== false) fail("extraction contract permits a forbidden mutation surface");
  if (inventoryReport?.archive?.name !== contract.authoritativeArchive.name || inventoryReport?.archive?.sha256 !== contract.authoritativeArchive.sha256 || inventoryReport?.archive?.bytes !== contract.authoritativeArchive.bytes) fail("inventory archive identity does not match extraction contract");
  if (inventoryReport?.archive?.identityChecks?.fileName !== true || inventoryReport?.archive?.identityChecks?.byteSize !== true || inventoryReport?.archive?.identityChecks?.sha256 !== true) fail("inventory does not prove archive identity");

  const freshInventory = inspectZipBuffer(archiveBuffer, intakePolicy);
  compareInventory(inventoryReport.inventory, freshInventory);
  validatePlan(inventoryReport, reconciliationPlan, contract);
  if (freshInventory.entryCount > contract.maxExtractedEntries) fail("archive entry count exceeds extraction contract");
  if (freshInventory.totalUncompressedBytes > contract.maxTotalExtractedBytes) fail("archive uncompressed bytes exceed extraction contract");

  const quarantineRoot = resolve(contract.quarantineRoot);
  const destinationPath = resolve(destination);
  if (destinationPath === quarantineRoot || !destinationPath.startsWith(`${quarantineRoot}${sep}`)) fail("destination is outside the quarantine root");
  await mkdir(quarantineRoot, { recursive: true });
  const canonicalRoot = await realpath(quarantineRoot);
  if (await exists(destinationPath)) fail("destination already exists");
  await mkdir(destinationPath, { recursive: false });
  const canonicalDestination = await realpath(destinationPath);
  if (!canonicalDestination.startsWith(`${canonicalRoot}${sep}`)) fail("resolved destination escapes quarantine root");

  const extracted = [];
  let totalBytes = 0;
  for (let index = 0; index < freshInventory.entries.length; index += 1) {
    const entry = freshInventory.entries[index];
    const decision = reconciliationPlan.decisions[index];
    const relative = safeArchivePath(entry.name);
    const output = resolve(destinationPath, relative);
    if (output !== destinationPath && !output.startsWith(`${destinationPath}${sep}`)) fail(`resolved entry path escapes destination: ${entry.name}`);

    if (entry.directory) {
      await mkdir(output, { recursive: true });
      continue;
    }

    const payload = readEntryPayload(archiveBuffer, entry);
    totalBytes += payload.length;
    if (totalBytes > contract.maxTotalExtractedBytes) fail("extracted bytes exceed extraction contract");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, payload, { flag: "wx", mode: 0o600 });
    extracted.push({ path: relative, bytes: payload.length, sha256: sha256(payload), action: decision.action });
  }

  const manifest = {
    schemaVersion: 1,
    project: contract.project,
    mode: contract.mode,
    archive: { ...contract.authoritativeArchive },
    planSha256: reconciliationPlan.planSha256,
    inventoryEntryCount: freshInventory.entryCount,
    extractedFileCount: extracted.length,
    extractedBytes: totalBytes,
    extractionDestination: canonicalDestination,
    canonicalIntegrationAuthorized: false,
    productionAuthorized: false,
    files: extracted
  };
  await writeFile(resolve(destinationPath, "extraction-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  return manifest;
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
