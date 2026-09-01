#!/usr/bin/env python3
"""Serve RamaVerse with deterministic SPA fallback and a health marker."""

from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"


class SPARequestHandler(SimpleHTTPRequestHandler):
    server_version = "RamaVerseSPA/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEB), **kwargs)

    def end_headers(self) -> None:
        self.send_header("X-RamaVerse-SPA", "active")
        super().end_headers()

    def _request_path(self) -> str:
        return unquote(urlsplit(self.path).path)

    def _needs_spa_fallback(self, request_path: str) -> bool:
        if request_path == "/":
            return False
        relative = request_path.lstrip("/")
        candidate = WEB / relative
        return not candidate.exists() and not Path(relative).suffix

    def _serve_index(self, *, head_only: bool = False) -> None:
        index = WEB / "index.html"
        payload = index.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(payload)

    def _serve_health(self, *, head_only: bool = False) -> None:
        payload = json.dumps(
            {
                "status": "ok",
                "service": "ramaverse-spa-qa",
                "spaFallback": True,
            }
        ).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if not head_only:
            self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802 - inherited HTTP method name
        request_path = self._request_path()
        if request_path == "/__health":
            self._serve_health()
        elif self._needs_spa_fallback(request_path):
            self._serve_index()
        else:
            super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802 - inherited HTTP method name
        request_path = self._request_path()
        if request_path == "/__health":
            self._serve_health(head_only=True)
        elif self._needs_spa_fallback(request_path):
            self._serve_index(head_only=True)
        else:
            super().do_HEAD()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[ramaverse-spa] {self.address_string()} {fmt % args}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4188)
    args = parser.parse_args()

    if not (WEB / "index.html").exists():
        raise SystemExit(f"Missing {(WEB / 'index.html')}")

    server = ThreadingHTTPServer((args.host, args.port), SPARequestHandler)
    print(f"RAMAVERSE_SPA_SERVER_ACTIVE http://{args.host}:{args.port}")
    print(f"Health check: http://{args.host}:{args.port}/__health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
