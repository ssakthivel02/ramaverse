import { copyFile } from "node:fs/promises";

await copyFile("dist/index.html", "dist/404.html");
console.log("DEEP_LINK_FALLBACK_READY: dist/404.html mirrors the SPA entry document.");
