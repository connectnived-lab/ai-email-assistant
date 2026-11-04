import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from common import run_e2e  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
SHOTS = os.path.join(ROOT, "docs")


def mock_reply(body):
    return json.dumps({"reply": "Mock reply: thanks Anita, pricing follows.", "actions": ["Mock action: send pricing"]})


def flow(page, mode):
    page.click("#sample")
    page.click("#analyze")
    page.wait_for_function("() => document.querySelector('#draft').value.length > 0")
    draft = page.input_value("#draft")
    out = page.inner_text("#output")
    if mode == "live":
        assert "Mock reply: thanks Anita" in draft, draft
        assert "Mock action: send pricing" in out, out
    else:
        assert "Hi Anita," in draft, draft
        assert "Nived" in draft
        assert "Answer:" in out and "Next actions" in out, out
        assert "Offer two times" in out, out
        page.wait_for_selector("#copy:not([disabled])")
    page.fill("#thread", "")
    page.click("#analyze")
    page.wait_for_selector("#error:not([hidden])")
    assert "Paste an email" in page.inner_text("#error")


if __name__ == "__main__":
    os.makedirs(SHOTS, exist_ok=True)
    summary = run_e2e(ROOT, flow, mock_reply, shot_dir=SHOTS)
    print(json.dumps(summary))
    print("E2E PASS")
