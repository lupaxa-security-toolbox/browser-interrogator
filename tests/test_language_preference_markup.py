from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADER = (ROOT / "overrides/partials/header.html").read_text(encoding="utf-8")
MKDOCS = (ROOT / "mkdocs.yml").read_text(encoding="utf-8")
NAV_CSS = (ROOT / "mkdocs/assets/stylesheets/30-navigation.css").read_text(encoding="utf-8")
RESPONSIVE_CSS = (ROOT / "mkdocs/assets/stylesheets/90-responsive.css").read_text(encoding="utf-8")
FOOTER = (ROOT / "overrides/partials/copyright.html").read_text(encoding="utf-8")
HIDE_SIDEBAR = (ROOT / "mkdocs/assets/stylesheets/hide-primary-sidebar.css").read_text(
    encoding="utf-8"
)
OVERRIDES_CSS = (ROOT / "mkdocs/assets/stylesheets/99-overrides.css").read_text(encoding="utf-8")


def test_header_has_custom_picker_not_alternate():
    assert 'id="lupaxa-lang"' in HEADER
    assert "partials/alternate.html" not in HEADER
    assert "extra.alternate" not in HEADER
    assert 'translate="no"' in HEADER
    assert 'value="en">English<' in HEADER
    assert 'value="fr">Français<' in HEADER
    assert 'value="de">Deutsch<' in HEADER
    assert 'value="es">Español<' in HEADER
    assert 'value="pt">Português<' in HEADER
    assert 'value="it">Italiano<' in HEADER
    assert 'value="nl">Nederlands<' in HEADER
    assert 'value="pl">Polski<' in HEADER
    assert 'value="bg">Български<' in HEADER
    assert 'value="cs">Čeština<' in HEADER
    assert 'value="da">Dansk<' in HEADER
    assert 'value="el">Ελληνικά<' in HEADER
    assert 'value="fi">Suomi<' in HEADER
    assert 'value="hr">Hrvatski<' in HEADER
    assert 'value="hu">Magyar<' in HEADER
    assert 'value="lt">Lietuvių<' in HEADER
    assert 'value="no">Norsk<' in HEADER
    assert 'value="ro">Română<' in HEADER
    assert 'value="sv">Svenska<' in HEADER
    assert 'value="tr">Türkçe<' in HEADER
    assert 'value="uk">Українська<' in HEADER
    assert 'value="ng"' not in HEADER
    assert 'value="eo"' not in HEADER
    assert 'value="la"' not in HEADER
    assert 'value="ja"' not in HEADER
    assert 'value="tlh"' not in HEADER
    assert "lupaxa-lang-picker__label" not in HEADER
    assert ">EN<" not in HEADER
    assert 'id="lupaxa-lang-fallback"' in HEADER
    assert 'class="lupaxa-lang-fallback notranslate"' in HEADER


def test_language_script_follows_page_lifecycle():
    scripts = [
        line.strip()
        for line in MKDOCS.splitlines()
        if line.strip().startswith("- assets/javascript/")
    ]
    assert "- assets/javascript/page-lifecycle.js" in scripts
    assert "- assets/javascript/language-preference.js" in scripts
    assert scripts.index("- assets/javascript/page-lifecycle.js") < scripts.index(
        "- assets/javascript/language-preference.js"
    )
    assert "extra.alternate" not in MKDOCS
    assert "mkdocs-static-i18n" not in MKDOCS
    assert "  language: en" in MKDOCS
    assert "social_locale: en_GB" in MKDOCS
    assert "language_picker: true" in MKDOCS
    assert "{% if config.extra.language_picker %}" in HEADER


def test_header_css_keeps_picker_out_of_nav_flex():
    assert ".lupaxa-lang-picker" in NAV_CSS
    assert ".lupaxa-lang-fallback" in NAV_CSS
    assert "max-width: 90rem" not in NAV_CSS
    assert "flex: 0 0 auto" in NAV_CSS


def test_footer_opts_out_of_translate():
    assert 'class="md-copyright notranslate" translate="no"' in FOOTER
    assert "partials/source.html" not in HEADER
    assert "repo_url:" not in MKDOCS
    assert "lupaxa-header__nav-label" in HEADER
    assert "text-decoration: underline" in NAV_CSS
    assert "lupaxa-header__nav-link::after" not in NAV_CSS


def test_header_nav_stays_visible_on_tablet():
    tablet = RESPONSIVE_CSS.split("@media screen and (max-width: 76.234375em)")[1].split("@media")[
        0
    ]
    narrow_header = RESPONSIVE_CSS.split("@media screen and (max-width: 54em)")[1].split("@media")[
        0
    ]
    assert ".lupaxa-header__nav" not in tablet
    assert ".lupaxa-header__nav" in narrow_header
    assert ".lupaxa-header__drawer-button" in narrow_header
    assert "max-width: 44.984375em" in HIDE_SIDEBAR
    assert "max-width: 76.234375em" not in HIDE_SIDEBAR
    assert ".md-header__button.lupaxa-header__drawer-button:not([hidden])" in OVERRIDES_CSS
