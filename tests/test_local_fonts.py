"""IBM Plex is served from this site, not Google Fonts."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def test_ibm_plex_is_self_hosted() -> None:
    yml = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
    html = (ROOT / "overrides/main.html").read_text(encoding="utf-8")
    css = (ROOT / "mkdocs/assets/stylesheets/00-fonts.css").read_text(encoding="utf-8")
    latin = ROOT / "mkdocs/assets/fonts/ibm-plex/ibm-plex-sans-normal-400-latin.woff2"
    assert "font: false" in yml
    assert "assets/stylesheets/00-fonts.css" in yml
    assert "fonts.googleapis.com" not in html
    assert "fonts.gstatic.com" not in css
    assert 'font-family: "IBM Plex Sans"' in css
    assert 'font-family: "IBM Plex Mono"' in css
    assert latin.read_bytes()[:4] == b"wOF2"
