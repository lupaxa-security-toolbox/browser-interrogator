"""The Interrogate Me page lists internet, web, device, and browser facts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = (ROOT / "mkdocs/interrogate-me.md").read_text(encoding="utf-8")
TABLES = (ROOT / "mkdocs/assets/stylesheets/40-components/tables.css").read_text(encoding="utf-8")
CONFIG = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")


def test_show_me_uses_template_tables() -> None:
    internet = PAGE.index('id="show-me-internet"')
    web = PAGE.index('id="show-me-web"')
    device = PAGE.index('id="show-me-device"')
    browser = PAGE.index('id="show-me-browser"')
    assert internet < web < device < browser
    assert 'class="show-me-facts"' not in PAGE
    assert "<table id=" in PAGE
    assert "table:not([class])" in TABLES
    assert "width: 32%" in TABLES
    assert "width: 100%" in TABLES
    assert "assets/javascript/show-me.js" in CONFIG
