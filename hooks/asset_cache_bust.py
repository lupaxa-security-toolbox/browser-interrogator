"""Append ?v=<git-sha> to extra CSS/JS so phones fetch new files after a publish."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
# mkdocs serve sets this so CSS and JavaScript URLs change when the files do.
_DEV_SERVER = False


def on_serve(server: object, config: dict[str, Any], **kwargs: object) -> object:
    """Mark this process as the dev server. The git SHA stays for real builds."""
    del config, kwargs
    global _DEV_SERVER
    _DEV_SERVER = True
    return server


def dev_asset_token(paths: list[Path]) -> str:
    """Return a token from the newest asset modification time."""
    newest = 0
    for path in paths:
        if path.is_file():
            newest = max(newest, path.stat().st_mtime_ns)
    return f"dev{newest}"


def asset_version(*, cwd: Path | None = None, asset_paths: list[Path] | None = None) -> str:
    """Return a short git SHA, or a file-time token while ``mkdocs serve`` is running."""
    if _DEV_SERVER:
        return dev_asset_token(asset_paths or [])
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=cwd or REPO_ROOT,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "dev"


def extra_asset_paths(config: dict[str, Any]) -> list[str]:
    """Clean extra_css / extra_javascript paths (no query string)."""
    paths: list[str] = []
    for item in config.get("extra_css") or []:
        paths.append(str(item).split("?", 1)[0])
    for item in config.get("extra_javascript") or []:
        raw = item.get("path") if isinstance(item, dict) else item
        paths.append(str(raw or "").split("?", 1)[0])
    return [path for path in paths if path]


def apply_asset_version(html: str, paths: list[str], version: str) -> str:
    """Rewrite extra asset href/src values to include ``?v=<version>``."""
    if not html or not paths or not version:
        return html
    unique = sorted({path for path in paths if path}, key=len, reverse=True)
    joined = "|".join(re.escape(path) for path in unique)
    pattern = re.compile(rf'(?P<attr>href|src)="(?P<before>[^"?]*?)(?P<path>{joined})(?:\?[^"]*)?"')
    return pattern.sub(
        rf'\g<attr>="\g<before>\g<path>?v={version}"',
        html,
    )


def on_post_page(output: str, page: object, config: dict[str, Any]) -> str:
    del page
    relative = extra_asset_paths(config)
    docs_dir = Path(str(config.get("docs_dir") or ""))
    version = asset_version(asset_paths=[docs_dir / path for path in relative])
    return apply_asset_version(output, relative, version)
