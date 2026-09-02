import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = "artifacts/visual";
const expected = [
  "desktop-home.png", "desktop-knowledge.png", "desktop-ask.png", "desktop-sources.png",
  "tablet-home.png", "tablet-knowledge.png", "tablet-ask.png", "tablet-sources.png",
  "mobile-home.png", "mobile-knowledge.png", "mobile-ask.png", "mobile-sources.png"
];

const actual = (await readdir(dir)).filter((name) => name.endsWith(".png")).sort();
const missing = expected.filter((name) => !actual.includes(name));
const unexpected = actual.filter((name) => !expected.includes(name));
if (missing.length || unexpected.length) {
  throw new Error(`Visual evidence inventory mismatch. missing=${missing.join(",")} unexpected=${unexpected.join(",")}`);
}

const files = [];
for (const name of expected) {
  const path = join(dir, name);
  const bytes = await readFile(path);
  files.push({
    name,
    bytes: (await stat(path)).size,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

const manifest = {
  schemaVersion: 1,
  project: "RamaVerse",
  candidateCommit: process.env.CANDIDATE_SHA || process.env.GITHUB_SHA || "local",
  generatedAt: new Date().toISOString(),
  deterministicCapture: {
    browser: "Chromium via Playwright",
    reducedMotion: true,
    animationsDisabled: true,
    caretHidden: true,
    surfaces: ["/", "/knowledge", "/ask", "/sources"],
    viewports: {
      desktop: { width: 1440, height: 1000 },
      tablet: { width: 820, height: 1180 },
      mobile: { width: 390, height: 844 }
    }
  },
  screenshots: files,
  canonicalImported: false,
  productionDeployment: false
};

await writeFile(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`VISUAL_EVIDENCE_PASS: ${files.length}/12 screenshots hashed for ${manifest.candidateCommit}`);
