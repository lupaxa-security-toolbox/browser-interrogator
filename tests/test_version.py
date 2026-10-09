"""Smoke test that the package version is a semantic version."""

from importlib.metadata import version

from packaging.version import Version

from snippets_mkdocs import __version__


def test_version() -> None:
    assert isinstance(__version__, str)
    parts = __version__.split(".")
    assert len(parts) >= 2
    assert all(part.isdigit() for part in parts[:2])
    assert Version(__version__) == Version(version("browser-interrogator"))
