const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;
const ZIP64_U16 = 0xffff;
const ZIP64_U32 = 0xffffffff;
const UNIX_SYMLINK = 0xa000;
const UNIX_FILE_TYPE_MASK = 0xf000;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function fail(message) {
  throw new Error(`RC_ZIP_INTAKE_FAIL: ${message}`);
}

function assertBounds(buffer, offset, length, label) {
  if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > buffer.length) {
    fail(`${label} escapes archive bounds`);
  }
}

function decodeEntryName(bytes, flags) {
  if (bytes.includes(0)) fail("entry name contains NUL byte");
  const utf8 = (flags & 0x0800) !== 0;
  if (!utf8 && bytes.some((byte) => byte > 0x7f)) {
    fail("non-ASCII entry name without UTF-8 flag is ambiguous");
  }
  const name = bytes.toString("utf8");
  if (Buffer.from(name, "utf8").compare(bytes) !== 0 && utf8) fail("entry name is not valid canonical UTF-8");
  return name;
}

function validatePortablePath(name, policy) {
  if (!name || name === "." || name === "./") fail("empty or dot entry path is not allowed");
  if (policy.rejectBackslashPaths && name.includes("\\")) fail(`backslash path is not allowed: ${name}`);
  if (policy.rejectAbsolutePaths && (name.startsWith("/") || /^[A-Za-z]:/.test(name))) fail(`absolute path is not allowed: ${name}`);

  const directory = name.endsWith("/");
  const rawSegments = name.split("/");
  if (directory) rawSegments.pop();
  if (!rawSegments.length) fail(`invalid root entry path: ${name}`);

  for (const segment of rawSegments) {
    if (!segment || segment === ".") fail(`empty/dot path segment is not allowed: ${name}`);
    if (policy.rejectParentTraversal && segment === "..") fail(`parent traversal is not allowed: ${name}`);
    if (segment.endsWith(".") || segment.endsWith(" ")) fail(`trailing dot/space path segment is not portable: ${name}`);
    if (segment.includes(":")) fail(`colon path segment is not portable: ${name}`);
    if (policy.rejectWindowsReservedNames && WINDOWS_RESERVED.test(segment)) fail(`Windows reserved path segment is not allowed: ${name}`);
  }

  return { directory, normalized: rawSegments.join("/") + (directory ? "/" : "") };
}

function findEocd(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - 0xffff);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;
    const commentLength = buffer.readUInt16LE(offset + 20);
    if (offset + 22 + commentLength !== buffer.length) continue;
    return offset;
  }
  fail("end-of-central-directory record not found");
}

function readDataDescriptor(buffer, offset, central) {
  assertBounds(buffer, offset, 12, `data descriptor for ${central.name}`);
  let cursor = offset;
  let signaturePresent = false;
  if (buffer.readUInt32LE(cursor) === DATA_DESCRIPTOR_SIGNATURE) {
    signaturePresent = true;
    cursor += 4;
    assertBounds(buffer, cursor, 12, `signed data descriptor for ${central.name}`);
  }
  const crc32 = buffer.readUInt32LE(cursor);
  const compressedSize = buffer.readUInt32LE(cursor + 4);
  const uncompressedSize = buffer.readUInt32LE(cursor + 8);
  if (crc32 !== central.crc32 || compressedSize !== central.compressedSize || uncompressedSize !== central.uncompressedSize) {
    fail(`data descriptor disagrees with central directory: ${central.name}`);
  }
  return offset + (signaturePresent ? 16 : 12);
}

function inspectLocalRecord(buffer, central, centralDirectoryOffset) {
  const offset = central.localHeaderOffset;
  assertBounds(buffer, offset, 30, `local header for ${central.name}`);
  if (buffer.readUInt32LE(offset) !== LOCAL_SIGNATURE) fail(`local header signature mismatch: ${central.name}`);

  const flags = buffer.readUInt16LE(offset + 6);
  const compressionMethod = buffer.readUInt16LE(offset + 8);
  const nameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const nameStart = offset + 30;
  assertBounds(buffer, nameStart, nameLength + extraLength, `local header variable fields for ${central.name}`);
  const localNameBytes = buffer.subarray(nameStart, nameStart + nameLength);

  if (localNameBytes.compare(central.nameBytes) !== 0) fail(`local/central entry name mismatch: ${central.name}`);
  if (compressionMethod !== central.compressionMethod) fail(`local/central compression mismatch: ${central.name}`);
  if ((flags & 0x0841) !== (central.flags & 0x0841)) fail(`local/central critical flag mismatch: ${central.name}`);

  const dataStart = nameStart + nameLength + extraLength;
  const dataEnd = dataStart + central.compressedSize;
  assertBounds(buffer, dataStart, central.compressedSize, `compressed data for ${central.name}`);
  if (dataEnd > centralDirectoryOffset) fail(`entry data reaches central directory: ${central.name}`);

  const occupiedEnd = (flags & 0x0008) !== 0 ? readDataDescriptor(buffer, dataEnd, central) : dataEnd;
  if (occupiedEnd > centralDirectoryOffset) fail(`entry descriptor reaches central directory: ${central.name}`);
  return { start: offset, end: occupiedEnd, dataStart, dataEnd };
}

export function inspectZipBuffer(buffer, policy) {
  if (!Buffer.isBuffer(buffer)) fail("archive must be provided as a Buffer");
  if (buffer.length < 22) fail("archive is too small to be a ZIP file");

  const eocdOffset = findEocd(buffer);
  assertBounds(buffer, eocdOffset, 22, "end-of-central-directory record");

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (!policy.allowMultiDisk && (diskNumber !== 0 || centralDisk !== 0 || entriesOnDisk !== totalEntries)) fail("multi-disk ZIP structures are not allowed");
  if (!policy.allowZip64 && (entriesOnDisk === ZIP64_U16 || totalEntries === ZIP64_U16 || centralSize === ZIP64_U32 || centralOffset === ZIP64_U32)) fail("ZIP64 structures are not allowed");
  if (totalEntries > policy.maxEntries) fail(`entry count ${totalEntries} exceeds limit ${policy.maxEntries}`);

  assertBounds(buffer, centralOffset, centralSize, "central directory");
  if (centralOffset + centralSize !== eocdOffset) fail("central directory is not immediately followed by EOCD");

  const entries = [];
  const seenExact = new Set();
  const seenFolded = new Set();
  let cursor = centralOffset;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < totalEntries; index += 1) {
    assertBounds(buffer, cursor, 46, `central directory entry ${index + 1}`);
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) fail(`central directory signature mismatch at entry ${index + 1}`);

    const versionMadeBy = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const crc32 = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const diskStart = buffer.readUInt16LE(cursor + 34);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);

    if (!policy.allowZip64 && (compressedSize === ZIP64_U32 || uncompressedSize === ZIP64_U32 || localHeaderOffset === ZIP64_U32 || diskStart === ZIP64_U16)) fail(`ZIP64 entry is not allowed at central index ${index + 1}`);
    if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) {
      if (!policy.allowEncryptedEntries) fail(`encrypted entry is not allowed at central index ${index + 1}`);
    }
    if (!policy.allowedCompressionMethods.includes(compressionMethod)) fail(`compression method ${compressionMethod} is not allowed at central index ${index + 1}`);
    if (nameLength === 0 || nameLength > policy.maxEntryNameBytes) fail(`entry name length ${nameLength} is outside allowed bounds at central index ${index + 1}`);

    const variableLength = nameLength + extraLength + commentLength;
    assertBounds(buffer, cursor + 46, variableLength, `central directory variable fields ${index + 1}`);
    const nameBytes = Buffer.from(buffer.subarray(cursor + 46, cursor + 46 + nameLength));
    const name = decodeEntryName(nameBytes, flags);
    const pathInfo = validatePortablePath(name, policy);

    if (seenExact.has(pathInfo.normalized)) fail(`duplicate entry path: ${pathInfo.normalized}`);
    seenExact.add(pathInfo.normalized);
    const folded = pathInfo.normalized.toLocaleLowerCase("en-US");
    if (policy.rejectCaseInsensitiveDuplicates && seenFolded.has(folded)) fail(`case-insensitive duplicate entry path: ${pathInfo.normalized}`);
    seenFolded.add(folded);

    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const isSymlink = (unixMode & UNIX_FILE_TYPE_MASK) === UNIX_SYMLINK;
    if (policy.allowSymlinks === false && isSymlink) fail(`symlink entry is not allowed: ${name}`);

    if (uncompressedSize > policy.maxEntryUncompressedBytes) fail(`entry exceeds uncompressed-size limit: ${name}`);
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > policy.maxTotalUncompressedBytes) fail(`archive exceeds total uncompressed-size limit ${policy.maxTotalUncompressedBytes}`);
    const ratio = uncompressedSize === 0 ? 0 : uncompressedSize / Math.max(compressedSize, 1);
    if (ratio > policy.maxCompressionRatio) fail(`entry compression ratio ${ratio.toFixed(2)} exceeds limit: ${name}`);

    entries.push({
      index: index + 1,
      name,
      nameBytes,
      directory: pathInfo.directory,
      flags,
      compressionMethod,
      crc32,
      compressedSize,
      uncompressedSize,
      compressionRatio: ratio,
      localHeaderOffset,
      unixMode,
    });

    cursor += 46 + variableLength;
  }

  if (cursor !== centralOffset + centralSize) fail("central directory size/count disagreement");

  const occupiedRanges = entries.map((entry) => ({ entry, range: inspectLocalRecord(buffer, entry, centralOffset) }));
  occupiedRanges.sort((a, b) => a.range.start - b.range.start);
  if (policy.rejectOverlappingDataRanges) {
    for (let index = 1; index < occupiedRanges.length; index += 1) {
      const previous = occupiedRanges[index - 1];
      const current = occupiedRanges[index];
      if (current.range.start < previous.range.end) fail(`overlapping local entry ranges: ${previous.entry.name} / ${current.entry.name}`);
    }
  }

  const inventoryEntries = entries.map(({ nameBytes: _nameBytes, ...entry }) => ({
    ...entry,
    crc32: entry.crc32.toString(16).padStart(8, "0"),
    unixMode: entry.unixMode.toString(8).padStart(6, "0"),
  }));
  const totalCompressedBytes = entries.reduce((sum, entry) => sum + entry.compressedSize, 0);

  return {
    zipFormat: "standard-non-zip64",
    entryCount: totalEntries,
    centralDirectoryOffset: centralOffset,
    centralDirectoryBytes: centralSize,
    totalCompressedBytes,
    totalUncompressedBytes,
    aggregateCompressionRatio: totalUncompressedBytes === 0 ? 0 : totalUncompressedBytes / Math.max(totalCompressedBytes, 1),
    entries: inventoryEntries,
  };
}
