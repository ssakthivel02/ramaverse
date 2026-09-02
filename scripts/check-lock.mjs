import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const gate = JSON.parse(await readFile("docs/DEPENDENCY_LOCK_GATE.json", "utf8"));
const lock = await readFile("package-lock.json");
const lockJson = JSON.parse(lock.toString("utf8"));
const digest = createHash("sha256").update(lock).digest("hex");
const bytes = (await stat("package-lock.json")).size;

const failures = [];
if (gate.project !== "RamaVerse") failures.push("project identity changed");
if (gate.packageVersion !== "0.3.0") failures.push("package version gate changed");
if (gate.nodeMajor !== 22) failures.push("Node major gate changed");
if (gate.packageLockVersion !== 3 || lockJson.lockfileVersion !== 3) failures.push("lockfile version changed");
if (gate.allowDependencyDrift !== false) failures.push("dependency drift was authorized");
if (digest !== gate.packageLockSha256) failures.push(`lock SHA mismatch ${digest}`);
if (bytes !== gate.packageLockBytes) failures.push(`lock byte-size mismatch ${bytes}`);

if (failures.length) {
  console.error(`DEPENDENCY_LOCK_GATE_FAIL: ${failures.join("; ")}`);
  process.exit(1);
}

console.log("DEPENDENCY_LOCK_GATE_PASS");
console.log(`PACKAGE_LOCK_SHA256=${digest}`);
console.log(`PACKAGE_LOCK_BYTES=${bytes}`);
console.log("DEPENDENCY_DRIFT_ALLOWED=false");
