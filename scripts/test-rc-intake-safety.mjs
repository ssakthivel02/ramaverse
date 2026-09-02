import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateRawSync } from "node:zlib";
import { requireRcIdentity } from "./lib/rc-identity.mjs";
import { inspectZipBuffer } from "./lib/zip-intake.mjs";

const policy = {
  allowMultiDisk: false,
  allowZip64: false,
  allowEncryptedEntries: false,
  allowSymlinks: false,
  allowedCompressionMethods: [0, 8],
  maxEntries: 20000,
  maxEntryNameBytes: 1024,
  maxEntryUncompressedBytes: 268435456,
  maxTotalUncompressedBytes: 1073741824,
  maxCompressionRatio: 200,
  rejectAbsolutePaths: true,
  rejectParentTraversal: true,
  rejectBackslashPaths: true,
  rejectCaseInsensitiveDuplicates: true,
  rejectWindowsReservedNames: true,
  requireLocalCentralNameMatch: true,
  rejectOverlappingDataRanges: true,
};

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entrySpecs) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const spec of entrySpecs) {
    const name = spec.name;
    const localName = spec.localName ?? name;
    const nameBytes = Buffer.from(name, "utf8");
    const localNameBytes = Buffer.from(localName, "utf8");
    const data = Buffer.isBuffer(spec.data) ? spec.data : Buffer.from(spec.data ?? "", "utf8");
    const method = spec.method ?? 0;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const descriptor = spec.dataDescriptor === true;
    const flags = (spec.flags ?? 0x0800) | (descriptor ? 0x0008 : 0);
    const crc = crc32(data);
    const compressedSize = spec.compressedSizeOverride ?? compressed.length;
    const uncompressedSize = spec.uncompressedSizeOverride ?? data.length;
    const mode = spec.mode ?? (name.endsWith("/") ? 0o040755 : 0o100644);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(descriptor ? 0 : crc, 14);
    local.writeUInt32LE(descriptor ? 0 : compressedSize, 18);
    local.writeUInt32LE(descriptor ? 0 : uncompressedSize, 22);
    local.writeUInt16LE(localNameBytes.length, 26);
    local.writeUInt16LE(0, 28);

    const descriptorBuffer = descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
    if (descriptor) {
      descriptorBuffer.writeUInt32LE(0x08074b50, 0);
      descriptorBuffer.writeUInt32LE(crc, 4);
      descriptorBuffer.writeUInt32LE(compressedSize, 8);
      descriptorBuffer.writeUInt32LE(uncompressedSize, 12);
    }

    const localRecord = Buffer.concat([local, localNameBytes, compressed, descriptorBuffer]);
    localParts.push(localRecord);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressedSize, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(((mode & 0xffff) << 16) >>> 0, 38);
    central.writeUInt32LE(spec.localOffsetOverride ?? localOffset, 42);
    centralParts.push(Buffer.concat([central, nameBytes]));

    localOffset += localRecord.length;
  }

  const localRegion = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entrySpecs.length, 8);
  eocd.writeUInt16LE(entrySpecs.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localRegion.length, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([localRegion, centralDirectory, eocd]);
}

function expectReject(label, buffer, fragment) {
  try {
    inspectZipBuffer(buffer, policy);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (!message.includes(fragment)) throw new Error(`${label}: wrong rejection: ${message}`);
    return;
  }
  throw new Error(`${label}: unsafe ZIP was accepted`);
}

const safeZip = buildZip([
  { name: "manifest.json", data: "{}" },
  { name: "collections/", data: "" },
  { name: "collections/data.jsonl", data: "{\"id\":1}\n", method: 8, dataDescriptor: true },
]);
const safeInventory = inspectZipBuffer(safeZip, policy);
if (safeInventory.entryCount !== 3) throw new Error("safe ZIP inventory count mismatch");
if (safeInventory.entries.some((entry) => entry.name.includes(".."))) throw new Error("safe ZIP inventory unexpectedly contains traversal");

expectReject("parent traversal", buildZip([{ name: "../escape.txt", data: "x" }]), "parent traversal");
expectReject("absolute path", buildZip([{ name: "/escape.txt", data: "x" }]), "absolute path");
expectReject("backslash path", buildZip([{ name: "collections\\escape.txt", data: "x" }]), "backslash path");
expectReject("reserved path", buildZip([{ name: "CON.txt", data: "x" }]), "Windows reserved");
expectReject("case collision", buildZip([{ name: "A.txt", data: "a" }, { name: "a.txt", data: "b" }]), "case-insensitive duplicate");
expectReject("symlink", buildZip([{ name: "link", data: "target", mode: 0o120777 }]), "symlink entry");
expectReject("encrypted", buildZip([{ name: "secret.txt", data: "x", flags: 0x0801 }]), "encrypted entry");
expectReject("unsupported compression", buildZip([{ name: "odd.bin", data: "x", method: 99 }]), "compression method 99");
expectReject("compression ratio", buildZip([{ name: "bomb.txt", data: "x", uncompressedSizeOverride: 10000 }]), "compression ratio");
expectReject("local central mismatch", buildZip([{ name: "central.txt", localName: "local.txt", data: "x" }]), "local/central entry name mismatch");

const multiDisk = Buffer.from(safeZip);
multiDisk.writeUInt16LE(1, multiDisk.length - 22 + 4);
expectReject("multi-disk", multiDisk, "multi-disk");

const zip64Marker = Buffer.from(safeZip);
zip64Marker.writeUInt16LE(0xffff, zip64Marker.length - 22 + 10);
expectReject("ZIP64", zip64Marker, "ZIP64");

const tempRoot = await mkdtemp(join(tmpdir(), "ramaverse-rc-intake-"));
try {
  const fixturePath = join(tempRoot, "fixture.zip");
  await writeFile(fixturePath, safeZip);
  const fixtureHash = createHash("sha256").update(safeZip).digest("hex");
  const fixtureGate = { archive: "fixture.zip", zipBytes: safeZip.length, sha256: fixtureHash };
  const identity = await requireRcIdentity(fixturePath, fixtureGate);
  if (!identity.pass) throw new Error("matching synthetic RC identity was rejected");

  let mismatchRejected = false;
  try {
    await requireRcIdentity(fixturePath, { ...fixtureGate, sha256: "0".repeat(64) });
  } catch (error) {
    mismatchRejected = String(error).includes("RC_GATE_FAIL");
  }
  if (!mismatchRejected) throw new Error("mismatched synthetic RC identity was accepted");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("RC_INTAKE_SAFETY_SELFTEST_PASS");
console.log("SAFE_ZIP_INVENTORY=PASS");
console.log("IDENTITY_MISMATCH_REJECTION=PASS");
console.log("TRAVERSAL_ABSOLUTE_BACKSLASH_REJECTION=PASS");
console.log("WINDOWS_RESERVED_CASE_COLLISION_REJECTION=PASS");
console.log("SYMLINK_ENCRYPTION_COMPRESSION_REJECTION=PASS");
console.log("ZIP64_MULTIDISK_REJECTION=PASS");
console.log("ZIP_BOMB_RATIO_REJECTION=PASS");
console.log("LOCAL_CENTRAL_NAME_MISMATCH_REJECTION=PASS");
