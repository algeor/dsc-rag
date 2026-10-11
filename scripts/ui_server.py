#!/usr/bin/env python3
"""Small local UI server for the RAG truth demo."""
from __future__ import annotations

import json
import mimetypes
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
UI_DIR = ROOT / "ui"
sys.path.insert(0, str(ROOT / "scripts"))

from demo import QUESTION, run, setup  # noqa: E402
from eval_confidence import run_eval  # noqa: E402

# The seed eval is fully deterministic (same 8 stages, same labels every time),
# so its metrics never change. Compute once, cache, and serve the cached copy —
# this keeps the toggle instant AND means it never mutates the live demo DB.
_EVAL_CACHE: dict | None = None


def _snapshot_partitions() -> list[tuple]:
    import sqlite3

    with sqlite3.connect(setup()) as conn:
        return conn.execute(
            "SELECT asset, business_date, country, status FROM partitions"
        ).fetchall()


def _restore_partitions(rows: list[tuple]) -> None:
    import sqlite3

    with sqlite3.connect(setup()) as conn:
        conn.execute("DELETE FROM partitions")
        conn.executemany("INSERT INTO partitions VALUES (?, ?, ?, ?)", rows)


def eval_report() -> dict:
    """Run (or return cached) seed eval, then expose a single calibrated-confidence
    percentage derived from the grounding ECE. run_eval() resets the operational
    DB as a side effect, so we snapshot and restore the presenter's live state."""
    global _EVAL_CACHE
    if _EVAL_CACHE is not None:
        return _EVAL_CACHE

    snapshot = _snapshot_partitions()
    try:
        report = run_eval()
    finally:
        _restore_partitions(snapshot)

    m = report["metrics"]
    report["display"] = {
        # One number, per the demo UI: grounding calibration = (1 - ECE) x 100.
        "calibrated_confidence_pct": round((1 - m["grounded_ece"]) * 100),
        "basis": "grounding calibration = (1 − ECE) × 100%, over 8 demo stages",
        "grounded_ece": m["grounded_ece"],
        "grounded_brier": m["grounded_brier"],
        "resolved_ece": m["resolved_ece"],
        "resolved_brier": m["resolved_brier"],
        "n_stages": len(report["rows"]),
    }
    _EVAL_CACHE = report
    return report


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "RagTruthUi/1.0"

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"{self.address_string()} - {fmt % args}")

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/api/defaults":
            json_response(self, 200, {"question": QUESTION, "date": "2026-10-09"})
            return

        if self.path == "/api/eval":
            try:
                json_response(self, 200, {"ok": True, "result": eval_report()})
            except Exception as exc:  # Keep the UI useful during live demos.
                json_response(self, 500, {"ok": False, "error": str(exc)})
            return

        route = self.path.split("?", 1)[0]
        rel = "index.html" if route in {"/", ""} else unquote(route.lstrip("/"))
        target = (UI_DIR / rel).resolve()
        if not str(target).startswith(str(UI_DIR.resolve())) or not target.exists() or target.is_dir():
            self.send_error(404, "Not found")
            return

        body = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/api/run":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            mode = payload.get("mode", "live")
            backend = payload.get("backend", "offline")
            disabled = payload.get("disabled", [])
            date = payload.get("date", "2026-10-09")
            question = payload.get("question") or QUESTION
            set_de = payload.get("set_de")
            reset = bool(payload.get("reset", False))

            setup(reset)
            if set_de:
                import sqlite3

                with sqlite3.connect(setup()) as conn:
                    conn.execute(
                        "UPDATE partitions SET status=? WHERE country=? AND business_date=?",
                        (set_de, "DE", date),
                    )

            result = run(
                q=question,
                mode=mode,
                backend=backend,
                disabled=disabled,
                date=date,
                use_llm=False,
            )
            json_response(self, 200, {"ok": True, "result": result})
        except Exception as exc:  # Keep the UI useful during live demos.
            json_response(self, 500, {"ok": False, "error": str(exc)})


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    setup(True)
    server = ThreadingHTTPServer(("127.0.0.1", port), DemoHandler)
    print(f"RAG truth UI running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
