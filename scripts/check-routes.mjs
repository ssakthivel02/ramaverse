import fs from "node:fs";

const routes = JSON.parse(fs.readFileSync(new URL("../src/data/routes.json", import.meta.url), "utf8"));
const paths = routes.map((route) => route.path);
const unique = new Set(paths);

if (routes.length !== 22) throw new Error(`Expected 22 registered routes, found ${routes.length}`);
if (unique.size !== routes.length) throw new Error("Duplicate route paths detected");
if (!unique.has("/knowledge")) throw new Error("Required /knowledge route missing");
if (!unique.has("/sources")) throw new Error("Required /sources trust route missing");

console.log(`ROUTE_CONTRACT_PASS: ${routes.length}/22 routes registered; /knowledge present.`);
