import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const required = ["index.html", "404.html", "manifest.webmanifest", "icon.svg", "sw.js"];
for (const file of required) {
  await stat(join("dist", file));
}

const index = await readFile("dist/index.html", "utf8");
const fallback = await readFile("dist/404.html", "utf8");
if (index !== fallback) throw new Error("Deep-link fallback must mirror dist/index.html exactly.");

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const files = await walk("dist");
const sizes = await Promise.all(files.map(async (path) => ({
  path: relative("dist", path),
  bytes: (await stat(path)).size,
})));

const total = sizes.reduce((sum, file) => sum + file.bytes, 0);
const js = sizes.filter((file) => file.path.endsWith(".js")).reduce((sum, file) => sum + file.bytes, 0);
const css = sizes.filter((file) => file.path.endsWith(".css")).reduce((sum, file) => sum + file.bytes, 0);

const budgets = {
  total: 1_500_000,
  js: 350_000,
  css: 120_000,
};

for (const [kind, actual] of Object.entries({ total, js, css })) {
  if (actual > budgets[kind]) {
    throw new Error(`${kind.toUpperCase()} budget exceeded: ${actual} > ${budgets[kind]} bytes`);
  }
}

console.log(`DIST_CONTRACT_PASS: total=${total}B js=${js}B css=${css}B files=${sizes.length}`);
