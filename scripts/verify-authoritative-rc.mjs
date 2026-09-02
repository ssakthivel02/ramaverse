import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const gate = JSON.parse(fs.readFileSync("docs/AUTHORITATIVE_RC_GATE.json", "utf8"));
const candidate = process.argv[2];

if (!candidate) {
  console.error("Usage: node scripts/verify-authoritative-rc.mjs <RAMAVERSE-WEBSITE-NATIVE-UPGRADE-RC.zip>");
  process.exit(2);
}

if (!fs.existsSync(candidate)) {
  console.error(`RC_GATE_FAIL: file not found: ${candidate}`);
  process.exit(1);
}

const stat = fs.statSync(candidate);
const hash = crypto.createHash("sha256");
const input = fs.createReadStream(candidate);
for await (const chunk of input) hash.update(chunk);
const digest = hash.digest("hex");

const checks = {
  fileName: path.basename(candidate) === gate.archive,
  byteSize: stat.size === gate.zipBytes,
  sha256: digest === gate.sha256,
};

console.log(JSON.stringify({ candidate: path.basename(candidate), bytes: stat.size, sha256: digest, checks }, null, 2));

if (!Object.values(checks).every(Boolean)) {
  console.error("RC_GATE_FAIL: candidate does not match the authoritative validated archive identity. Do not extract or integrate it.");
  process.exit(1);
}

console.log("RC_IDENTITY_GATE_PASS: archive identity matches validation evidence. Extraction/reconciliation is the next permitted operation; canonical approval is NOT implied.");
