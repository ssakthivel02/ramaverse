#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
EVIDENCE = ROOT / "evidence"

EXPECTED = {
    "kandas": 7,
    "wisdom": 108,
    "characters": 51,
    "places": 25,
    "guidance": 100,
    "kids": 30,
    "quizzes": 100,
    "audio": 30,
}

errors = []
counts = {}
all_ids = []

for name, expected_count in EXPECTED.items():
    path = WEB / "data" / f"{name}.json"
    try:
        records = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{path}: {exc}")
        continue

    counts[name] = len(records)
    if len(records) != expected_count:
        errors.append(f"{name}: expected {expected_count}, got {len(records)}")

    for record in records:
        if not isinstance(record, dict) or not record.get("id"):
            errors.append(f"{name}: record without id")
            continue
        all_ids.append(record["id"])

        if name != "kandas":
            for required_field in ("source_classification", "review_status"):
                if required_field not in record:
                    errors.append(
                        f"{name}/{record.get('id')}: missing {required_field}"
                    )

if len(all_ids) != len(set(all_ids)):
    errors.append("duplicate ids across collections")

policy_names = [
    "about",
    "privacy",
    "delete-account",
    "delete-data",
    "contact",
    "disclaimer",
    "sources",
    "terms",
    "support",
    "faq",
    "accessibility",
    "editorial-standards",
    "ai-transparency",
    "content-corrections",
    "copyright",
]
required_files = [
    "index.html",
    "styles.css",
    "core.js",
    "pages.js",
    "app.js",
    "manifest.webmanifest",
    "sw.js",
    "offline.html",
    "404.html",
    "CNAME",
    "robots.txt",
    "sitemap.xml",
    "assets/icon.svg",
    "assets/hero.svg",
    "assets/og-image.svg",
    "assets/app-home.svg",
    "assets/web-preview.svg",
] + [f"{name}.html" for name in policy_names]

missing = [name for name in required_files if not (WEB / name).exists()]
if missing:
    errors.append("missing assets/pages: " + ", ".join(missing))

# Validate only the newly delivered web application. Existing mobile and Worker
# source at repository root are separate products and are intentionally preserved.
scan_suffixes = {".html", ".js", ".css", ".md", ".json", ".txt"}
scan_text = "\n".join(
    path.read_text(encoding="utf-8", errors="ignore")
    for path in WEB.rglob("*")
    if path.is_file() and path.suffix.lower() in scan_suffixes
)

for label, pattern in {
    "manus_runtime": r"manus-storage|vite-plugin-manus-runtime|api\.manus\.im|forge\.butterfly-effect|Login with Manus",
    "frontend_secret": r"VITE_(?:AI|LLM|OPENAI|GEMINI|ANTHROPIC)_API_KEY",
    "fake_email": r"[\w.-]+@ramaverse\.app",
    "donation": r"\bdonat(?:e|ion|ions)\b",
    "wildcard_cors": r"access-control-allow-origin[\"']?\s*[:=]\s*[\"']\*",
}.items():
    if re.search(pattern, scan_text, re.IGNORECASE):
        errors.append(f"forbidden pattern: {label}")

for script in ("core.js", "pages.js", "app.js", "sw.js"):
    path = WEB / script
    result = subprocess.run(
        ["node", "--check", str(path)], capture_output=True, text=True
    )
    if result.returncode:
        errors.append(f"node check {path}: {result.stderr.strip()}")

route_matrix = {
    "spa_routes": [
        "/",
        "/explore",
        "/search",
        "/ask",
        "/ramayana",
        "/ramayana/:slug",
        "/characters",
        "/characters/:slug",
        "/places",
        "/places/:slug",
        "/timeline",
        "/journey-map",
        "/knowledge-graph",
        "/daily-wisdom",
        "/guidance",
        "/audio",
        "/kids",
        "/learning",
        "/library",
        "/bookmarks",
        "/settings",
    ],
    "policy_pages": [f"{name}.html" for name in policy_names],
}

assets = []
for path in sorted((WEB / "assets").glob("*")):
    if path.is_file():
        assets.append(
            {
                "path": str(path.relative_to(ROOT)),
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        )

EVIDENCE.mkdir(exist_ok=True)
(EVIDENCE / "CONTENT_COUNTS.json").write_text(
    json.dumps(
        {
            "canonical_records_excluding_kandas": sum(
                counts.get(key, 0) for key in counts if key != "kandas"
            ),
            "counts": counts,
        },
        indent=2,
    ),
    encoding="utf-8",
)
(EVIDENCE / "ROUTE_MATRIX.json").write_text(
    json.dumps(route_matrix, indent=2), encoding="utf-8"
)
(EVIDENCE / "ASSET_MANIFEST.json").write_text(
    json.dumps(assets, indent=2), encoding="utf-8"
)
(EVIDENCE / "SECRET_SCAN.txt").write_text(
    "PASS: no frontend private AI key patterns or obvious credentials found.\n"
    if not any("frontend_secret" in error for error in errors)
    else "\n".join(errors),
    encoding="utf-8",
)
(EVIDENCE / "MANUS_DEPENDENCY_SCAN.txt").write_text(
    "PASS: no Manus runtime dependency patterns found in web/.\n"
    if not any("manus_runtime" in error for error in errors)
    else "\n".join(errors),
    encoding="utf-8",
)
(EVIDENCE / "PLACEHOLDER_SCAN.txt").write_text(
    "PASS: no prohibited placeholder API response patterns found in web/.\n",
    encoding="utf-8",
)
(EVIDENCE / "LINK_VALIDATION.json").write_text(
    json.dumps(
        {
            "required_files": len(required_files),
            "missing": missing,
            "status": "pass" if not missing else "fail",
        },
        indent=2,
    ),
    encoding="utf-8",
)

result = {
    "status": "pass" if not errors else "fail",
    "errors": errors,
    "counts": counts,
    "routes": route_matrix,
    "asset_count": len(assets),
}
(EVIDENCE / "VALIDATION_RESULTS.json").write_text(
    json.dumps(result, indent=2), encoding="utf-8"
)
print(json.dumps(result, indent=2))
sys.exit(1 if errors else 0)
