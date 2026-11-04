"""Shared Playwright smoke harness: serves the repo, runs a flow at two viewports in demo
and live (mocked OpenAI-compatible endpoint) modes, and fails on console errors or
horizontal scroll. Requires: pip install playwright && playwright install chromium."""
import json
import os
import sys
import threading
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

from playwright.sync_api import sync_playwright

MOCK_BASE = "https://mock-llm.test/v1"
VIEWPORTS = {"mobile": (390, 844), "desktop": (1440, 900)}
IGNORED_ERRORS = ("favicon", "Failed to load resource: the server responded with a status of 404")


class _Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(root):
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(_Quiet, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/"


def configure_live(page):
    page.click("#open-settings")
    page.select_option("#settings-mode", "live")
    page.fill("#settings-base-url", MOCK_BASE)
    page.fill("#settings-api-key", "test-key-not-real")
    page.fill("#settings-model", "mock-model")
    page.click("#settings-save")
    page.wait_for_selector("#mode-badge.live")


def run_e2e(root, flow, mock_reply, shot_dir=None):
    """flow(page, mode) drives the app and asserts. mock_reply(request_body) -> text.
    Returns a summary dict; raises AssertionError on any failure."""
    srv, base = serve(root)
    checks = []
    mock_calls = {"demo": 0, "live": 0}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for vname, (w, h) in VIEWPORTS.items():
                for mode in ("demo", "live"):
                    ctx = browser.new_context(viewport={"width": w, "height": h})
                    page = ctx.new_page()
                    errors = []
                    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

                    def handle(route, request, mode=mode):
                        mock_calls[mode] += 1
                        body = json.loads(request.post_data or "{}")
                        route.fulfill(
                            status=200,
                            content_type="application/json",
                            body=json.dumps({"choices": [{"message": {"role": "assistant", "content": mock_reply(body)}}]}),
                        )

                    page.route("https://mock-llm.test/**", handle)
                    page.goto(base)
                    page.wait_for_load_state("networkidle")
                    if mode == "live":
                        configure_live(page)
                    else:
                        assert page.inner_text("#mode-badge") == "Demo mode"
                    flow(page, mode)
                    no_overflow = page.evaluate(
                        "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth"
                    )
                    real_errors = [e for e in errors if not any(i in e for i in IGNORED_ERRORS)]
                    assert no_overflow, f"horizontal scroll at {vname} {mode}"
                    assert not real_errors, f"console errors at {vname} {mode}: {real_errors}"
                    if mode == "demo" and shot_dir:
                        page.screenshot(path=os.path.join(shot_dir, f"screenshot-{vname}.png"), full_page=False)
                    checks.append(f"{vname}/{mode}")
                    ctx.close()
            browser.close()
    finally:
        srv.shutdown()
    assert mock_calls["demo"] == 0, "demo mode must never call the network"
    assert mock_calls["live"] >= len(VIEWPORTS), "live mode should have used the mocked endpoint"
    return {"passed_checks": checks, "mock_calls": mock_calls}
