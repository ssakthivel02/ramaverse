import fs from "node:fs";
import { requireRcIdentity } from "./lib/rc-identity.mjs";

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

try {
  const result = await requireRcIdentity(candidate, gate);
  console.log(JSON.stringify({ candidate: result.candidate, bytes: result.bytes, sha256: result.sha256, checks: result.checks }, null, 2));
  console.log("RC_IDENTITY_GATE_PASS: archive identity matches validation evidence. Safe structural inventory is the next permitted operation; canonical approval is NOT implied.");
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
