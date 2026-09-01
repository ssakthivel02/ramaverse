#!/usr/bin/env python3
"""HTTP smoke-test RamaVerse SPA routes using the marked fallback server."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:4188"
ROUTES = [
    "/",
    "/explore",
    "/search",
    "/ask",
    "/ramayana",
    "/ramayana/bala",
    "/characters",
    "/characters/rama",
    "/characters/sita",
    "/characters/lakshmana",
    "/characters/hanuman",
    "/places",
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
]


def fetch(path: str) -> tuple[int, str, str]:
    with urlopen(BASE_URL + path, timeout=5) as response:  # noqa: S310 - localhost only
        return (
            response.status,
            response.read().decode("utf-8", errors="replace"),
            response.headers.get("X-RamaVerse-SPA", ""),
        )


def main() -> int:
    process = subprocess.Popen(
        [sys.executable, str(ROOT / "tools" / "serve_spa.py")],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    try:
        for _ in range(40):
            try:
                status, body, marker = fetch("/__health")
                health = json.loads(body)
                if status == 200 and marker == "active" and health.get("spaFallback") is True:
                    break
            except (URLError, json.JSONDecodeError):
                time.sleep(0.1)
        else:
            print("Marked RamaVerse SPA server did not become ready", file=sys.stderr)
            return 1

        failures: list[str] = []
        for route in ROUTES:
            try:
                status, body, marker = fetch(route)
            except Exception as exc:  # pragma: no cover - diagnostic path
                failures.append(f"{route}: {exc}")
                continue
            if status != 200:
                failures.append(f"{route}: HTTP {status}")
            elif marker != "active":
                failures.append(f"{route}: wrong local server; SPA marker missing")
            elif 'id="app"' not in body:
                failures.append(f"{route}: SPA shell missing")

        if failures:
            print("SPA route failures:")
            print("\n".join(failures))
            return 1

        print(f"PASS: {len(ROUTES)} SPA routes returned the marked application shell")
        return 0
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    raise SystemExit(main())
