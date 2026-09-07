import { createHash } from "node:crypto";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promoteQuarantineToReviewStaging } from "./lib/staging-promotion.mjs";

const realContract = JSON.parse(await readFile("docs/STAGING_PROMOTION_CONTRACT.json", "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const archive = { ...realContract.authoritativeArchive };

async function exists(path) { try { await access(path); return true; } catch { return false; } }
async function expectReject(label, fn, fragment) {
  try { await fn(); throw new Error(`${label}: unsafe promotion accepted`); }
  catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (message.includes("unsafe promotion accepted")) throw error;
    if (fragment && !message.includes(fragment)) throw new Error(`${label}: wrong rejection: ${message}`);
  }
}

const temp = await mkdtemp(join(tmpdir(), "ramaverse-staging-test-"));
try {
  const quarantineDir = join(temp, "quarantine");
  await mkdir(join(quarantineDir, "src"), { recursive: true });
  await mkdir(join(quarantineDir, "content"), { recursive: true });
  await mkdir(join(quarantineDir, "mobile"), { recursive: true });
  const files = [
    ["src/App.tsx", Buffer.from("export default function App(){return null}\n"), "review-website-source"],
    ["content/kandas.json", Buffer.from("{\"records\":[]}\n"), "review-canonical-candidate"],
    ["mobile/App.kt", Buffer.from("// untouched mobile candidate\n"), "quarantine-mobile-vc14"]
  ];
  for (const [path, payload] of files) await writeFile(join(quarantineDir, path), payload);
  const plan = {
    project: "RamaVerse", archive, planSha256: "a".repeat(64), summary: { blockers: 0 }, blockers: [],
    decisions: files.map(([path,,action], i) => ({ inventoryIndex:i+1, path, action, blocker:false, extractionAuthorized:false, integrationAuthorized:false }))
  };
  const manifest = {
    schemaVersion:1, project:"RamaVerse", mode:realContract.requiredQuarantineMode, archive,
    planSha256:plan.planSha256, extractedFileCount:files.length, canonicalIntegrationAuthorized:false, productionAuthorized:false,
    files: files.map(([path,payload,action]) => ({ path, bytes:payload.length, sha256:sha256(payload), action }))
  };
  const stagingRoot = join(temp, "staging");
  const testContract = { ...realContract, stagingRoot, promotionAuthorized:true };
  const destination = join(stagingRoot, "run-001");
  const result = await promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:manifest, reconciliationPlan:plan, contract:testContract, destination });
  if (result.promotedFileCount !== 2 || result.skippedFileCount !== 1) throw new Error("promotion counts mismatch");
  if (result.canonicalWinnerSelected !== false || result.canonicalIntegrationAuthorized !== false || result.productionAuthorized !== false) throw new Error("promotion manifest authorized a prohibited downstream state");
  if (!(await exists(join(destination,"src/App.tsx"))) || !(await exists(join(destination,"content/kandas.json")))) throw new Error("reviewable files were not promoted");
  if (await exists(join(destination,"mobile/App.kt"))) throw new Error("Mobile/VC14 file crossed staging gate");
  if (!(await exists(join(quarantineDir,"src/App.tsx"))) || !(await exists(join(quarantineDir,"mobile/App.kt"))) throw new Error("copy-only gate mutated quarantine source");
  const persisted = JSON.parse(await readFile(join(destination,"promotion-manifest.json"),"utf8"));
  if (!/^[a-f0-9]{64}$/.test(persisted.promotionManifestSha256)) throw new Error("promotion manifest digest missing");

  await expectReject("real checked-in authorization", () => promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:manifest, reconciliationPlan:plan, contract:realContract, destination:join(temp,"must-not-create") }), "authorization is not true");
  if (await exists(join(temp,"must-not-create"))) throw new Error("unauthorized promotion created destination");

  await expectReject("outside staging root", () => promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:manifest, reconciliationPlan:plan, contract:testContract, destination:join(temp,"outside") }), "outside the staging root");
  const existing = join(stagingRoot,"existing"); await mkdir(existing,{recursive:true});
  await expectReject("existing destination", () => promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:manifest, reconciliationPlan:plan, contract:testContract, destination:existing }), "destination already exists");

  const tampered = structuredClone(manifest); tampered.files[0].sha256 = "0".repeat(64);
  await expectReject("tampered quarantine hash", () => promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:tampered, reconciliationPlan:plan, contract:testContract, destination:join(stagingRoot,"tampered") }), "integrity mismatch");

  const mismatchedPlan = structuredClone(plan); mismatchedPlan.planSha256 = "b".repeat(64);
  await expectReject("plan hash mismatch", () => promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:manifest, reconciliationPlan:mismatchedPlan, contract:testContract, destination:join(stagingRoot,"plan-mismatch") }), "plan SHA-256");

  const blockedPlan = structuredClone(plan); blockedPlan.summary.blockers=1; blockedPlan.blockers=[{path:"foreign.json",action:"reject-cross-project"}];
  await expectReject("blocked plan", () => promoteQuarantineToReviewStaging({ quarantineDirectory:quarantineDir, quarantineManifest:manifest, reconciliationPlan:blockedPlan, contract:testContract, destination:join(stagingRoot,"blocked") }), "contains blockers");
} finally {
  await rm(temp,{recursive:true,force:true});
}
console.log("STAGING_PROMOTION_SELFTEST_PASS");
console.log("SYNTHETIC_REVIEWABLE_COPY=PASS");
console.log("MOBILE_VC14_EXCLUSION=PASS");
console.log("COPY_ONLY_QUARANTINE_PRESERVATION=PASS");
console.log("REAL_CHECKED_IN_AUTHORIZATION_REFUSAL=PASS");
console.log("OUT_OF_ROOT_REJECTION=PASS");
console.log("PREEXISTING_DESTINATION_REJECTION=PASS");
console.log("TAMPERED_HASH_REJECTION=PASS");
console.log("PLAN_HASH_MISMATCH_REJECTION=PASS");
console.log("BLOCKED_PLAN_REJECTION=PASS");
console.log("CANONICAL_WINNER_INTEGRATION_PRODUCTION=false");
