from pathlib import Path

from asset_cache_bust import apply_asset_version, extra_asset_paths


def test_extra_asset_paths_strips_queries_and_dict_javascript() -> None:
    paths = extra_asset_paths(
        {
            "extra_css": ["assets/stylesheets/00-tokens.css?v=old"],
            "extra_javascript": [
                "assets/javascript/page-lifecycle.js",
                {"path": "assets/javascript/snippet-modal.js", "type": "module"},
            ],
        }
    )
    assert paths == [
        "assets/stylesheets/00-tokens.css",
        "assets/javascript/page-lifecycle.js",
        "assets/javascript/snippet-modal.js",
    ]


def test_apply_asset_version_rewrites_relative_extra_assets_only() -> None:
    html = """
<link rel="stylesheet" href="../assets/stylesheets/main.ec1eaa64.min.css">
<link rel="stylesheet" href="../assets/stylesheets/catalogue.css">
<script src="../assets/javascripts/bundle.d7400e89.min.js"></script>
<script src="../assets/javascript/catalogue-filters.js"></script>
"""
    out = apply_asset_version(
        html,
        [
            "assets/stylesheets/catalogue.css",
            "assets/javascript/catalogue-filters.js",
        ],
        "9ee1eb2",
    )
    assert 'href="../assets/stylesheets/catalogue.css?v=9ee1eb2"' in out
    assert 'src="../assets/javascript/catalogue-filters.js?v=9ee1eb2"' in out
    assert "main.ec1eaa64.min.css?" not in out
    assert "bundle.d7400e89.min.js?" not in out


def test_apply_asset_version_replaces_an_existing_query() -> None:
    html = '<link rel="stylesheet" href="assets/stylesheets/99-overrides.css?v=old">'
    out = apply_asset_version(
        html,
        ["assets/stylesheets/99-overrides.css"],
        "abc1234",
    )
    assert out == ('<link rel="stylesheet" href="assets/stylesheets/99-overrides.css?v=abc1234">')


def test_mkdocs_registers_the_hook() -> None:
    yml = (Path(__file__).resolve().parent.parent / "mkdocs.yml").read_text(encoding="utf-8")
    assert "- hooks/asset_cache_bust.py" in yml
