"""The edge Worker is what the page asks first, and it does not store the visit."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "mkdocs/assets/javascript/show-me.js").read_text(encoding="utf-8")
WORKER = (ROOT / "worker/index.js").read_text(encoding="utf-8")
CONFIG = (ROOT / "wrangler.jsonc").read_text(encoding="utf-8")
DOCS = (ROOT / "mkdocs/how-it-works.md").read_text(encoding="utf-8")

EDGE = "https://browser-interrogator.thelupaxaproject.workers.dev/"


def test_page_asks_the_worker_before_the_public_lookups() -> None:
    assert EDGE in PAGE
    assert PAGE.index(EDGE) < PAGE.index("https://ipwho.is/")
    assert "Edge TLS Version" in PAGE
    assert EDGE in DOCS


def test_worker_discards_the_visit() -> None:
    assert "browser-interrogator" in CONFIG
    assert "worker/index.js" in CONFIG
    assert "no-store" in WORKER
    assert "console." not in WORKER
    assert "metroCode" in WORKER
    assert "request.headers" in WORKER
    assert "Metro Code" in PAGE
    assert "Edge Header Order" in PAGE
    assert "Client Random" in PAGE
