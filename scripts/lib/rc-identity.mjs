import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";

export async function calculateFileSha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

export async function inspectRcIdentity(filePath, gate) {
  const fileStat = await stat(filePath);
  const digest = await calculateFileSha256(filePath);
  const checks = {
    fileName: basename(filePath) === gate.archive,
    byteSize: fileStat.size === gate.zipBytes,
    sha256: digest === gate.sha256,
  };
  return {
    candidate: basename(filePath),
    bytes: fileStat.size,
    sha256: digest,
    checks,
    pass: Object.values(checks).every(Boolean),
  };
}

export async function requireRcIdentity(filePath, gate) {
  const result = await inspectRcIdentity(filePath, gate);
  if (!result.pass) {
    throw new Error("RC_GATE_FAIL: candidate does not match the authoritative validated archive identity. Do not inspect, extract, or integrate it.");
  }
  return result;
}
