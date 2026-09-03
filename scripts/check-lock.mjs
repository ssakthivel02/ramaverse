import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

const gate = JSON.parse(await readFile("docs/DEPENDENCY_LOCK_GATE.json", "utf8"));
const lock = await readFile("package-lock.json");
const lockJson = JSON.parse(lock.toString("utf8"));
const digest = createHash("sha256").update(lock).digest("hex");
const bytes = (await stat("package-lock.json")).size;
const packageEntries = Object.keys(lockJson.packages ?? {}).length;
const postcss = lockJson.packages?.[gate.reviewedTransitiveChange?.packagePath];

const failures = [];
if (gate.schemaVersion !== 2) failures.push("dependency lock gate schemaVersion changed");
if (gate.project !== "RamaVerse") failures.push("project identity changed");
if (gate.packageVersion !== "0.3.0") failures.push("package version gate changed");
if (gate.nodeMajor !== 22) failures.push("Node major gate changed");
if (gate.packageLockVersion !== 3 || lockJson.lockfileVersion !== 3) failures.push("lockfile version changed");
if (gate.allowDependencyDrift !== false) failures.push("dependency drift was authorized");
if (digest !== gate.packageLockSha256) failures.push(`lock SHA mismatch ${digest}`);
if (bytes !== gate.packageLockBytes) failures.push(`lock byte-size mismatch ${bytes}`);
if (packageEntries !== gate.expectedPackageEntries) failures.push(`package-entry count mismatch ${packageEntries}`);

const reviewed = gate.reviewedTransitiveChange;
if (!reviewed || reviewed.packagePath !== "node_modules/postcss") failures.push("reviewed transitive change identity is missing");
if (reviewed?.packagePathsBefore !== gate.expectedPackageEntries || reviewed?.packagePathsAfter !== gate.expectedPackageEntries) failures.push("reviewed package-path count evidence changed");
if (reviewed?.productionAuditHigh !== "pass" || gate.productionAuditHigh !== "pass") failures.push("production audit evidence is not pass");
if (!postcss) {
  failures.push("reviewed PostCSS package path is missing");
} else {
  if (postcss.version !== reviewed.toVersion) failures.push(`PostCSS version mismatch ${postcss.version}`);
  if (postcss.resolved !== reviewed.resolved) failures.push("PostCSS resolved artifact changed");
  if (postcss.integrity !== reviewed.integrity) failures.push("PostCSS integrity changed");
  if (postcss.dependencies?.nanoid !== reviewed.nanoidRange) failures.push(`PostCSS nanoid range changed ${postcss.dependencies?.nanoid ?? "<missing>"}`);
}

if (failures.length) {
  console.error(`DEPENDENCY_LOCK_GATE_FAIL: ${failures.join("; ")}`);
  process.exit(1);
}

console.log("DEPENDENCY_LOCK_GATE_PASS");
console.log(`PACKAGE_LOCK_SHA256=${digest}`);
console.log(`PACKAGE_LOCK_BYTES=${bytes}`);
console.log(`PACKAGE_ENTRIES=${packageEntries}`);
console.log(`REVIEWED_POSTCSS_VERSION=${postcss.version}`);
console.log(`REVIEWED_POSTCSS_INTEGRITY=${postcss.integrity}`);
console.log("PRODUCTION_AUDIT_HIGH=pass");
console.log("DEPENDENCY_DRIFT_ALLOWED=false");
