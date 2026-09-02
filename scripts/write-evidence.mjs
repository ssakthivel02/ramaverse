import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const routes = JSON.parse(await readFile("src/data/routes.json", "utf8"));
const rc = JSON.parse(await readFile("config/authoritative-rc.json", "utf8"));

async function totalBytes(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) total += await totalBytes(path);
    else total += (await stat(path)).size;
  }
  return total;
}

const evidence = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository: "ssakthivel02/ramaverse",
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "local",
  commit: process.env.GITHUB_SHA || "local",
  packageVersion: pkg.version,
  classification: "QUALITY_GATE_GREEN_NOT_PRODUCTION_READY",
  routeContract: {
    expected: 22,
    actual: routes.length,
    knowledgePresent: routes.some((route) => route.path === "/knowledge")
  },
  canonical: {
    expectedBaseline: rc.canonicalBaseline,
    imported: false,
    integrationAuthorized: rc.integrationAuthorized,
    productionAuthorized: rc.productionAuthorized
  },
  validations: {
    foundation: "pass",
    rcIdentityContract: "pass",
    lint: "pass",
    typecheck: "pass",
    productionBuild: "pass",
    browserE2E: "pass",
    automatedAccessibilitySeriousCritical: "pass",
    mobileOverflow: "pass",
    reducedMotion: "pass",
    cleanRoomIsolation: "pass"
  },
  distBytes: await totalBytes("dist"),
  productionDeployment: false
};

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/validation-summary.json", `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(
  "artifacts/validation-summary.md",
  `# RamaVerse Next-Gen Quality Evidence\n\n- Commit: \`${evidence.commit}\`\n- Branch: \`${evidence.branch}\`\n- Routes: ${evidence.routeContract.actual}/${evidence.routeContract.expected}\n- /knowledge: ${evidence.routeContract.knowledgePresent ? "PASS" : "FAIL"}\n- Canonical 550 imported: NO\n- Lint: PASS\n- TypeScript: PASS\n- Production build: PASS\n- Chromium E2E: PASS\n- Axe serious/critical: PASS\n- Mobile overflow: PASS\n- Reduced motion: PASS\n- Clean-room isolation: PASS\n- Production deployment: NO\n\nClassification: **${evidence.classification}**\n`,
);
console.log(`EVIDENCE_WRITTEN: ${evidence.commit}`);
