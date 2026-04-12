"""
Browser CORS policy.

Allowed ``Origin`` values are **only** those listed in the environment variable
``CORS_ORIGINS`` (comma-separated, no trailing slashes). There is no host-based
auto-detection or regex allowlist in code — add every frontend URL explicitly
in ``.env`` / ``.env.production`` or your host’s environment panel.

In ``FLASK_ENV=development``, if ``CORS_ORIGINS`` is empty, a small set of
local dev URLs is used so ``flask run`` works without editing env.
"""

from __future__ import annotations

import os
from typing import Final

from flask import Flask
from flask_cors import CORS

_DEV_FALLBACK_ORIGINS: Final[tuple[str, ...]] = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4200",
    "http://127.0.0.1:4200",
)


def normalize_origin(value: str) -> str:
    """Trim and remove a single trailing slash so ``https://a/`` matches ``https://a``."""
    o = value.strip()
    if len(o) > 1 and o.endswith("/"):
        return o.rstrip("/")
    return o


def _origins_from_cors_env() -> list[str]:
    """Parse ``CORS_ORIGINS`` only; returns empty list if unset or blank."""
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if not raw:
        return []
    return [normalize_origin(part) for part in raw.split(",") if part.strip()]


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def resolve_cors_allowlist(*, flask_env: str) -> list[str]:
    """
    Build the allowlist for ``Access-Control-Allow-Origin``.

    - **Production** (and any non-development env): ``CORS_ORIGINS`` must be
      non-empty or startup fails with a clear error.
    - **Development**: if ``CORS_ORIGINS`` is empty, use local dev defaults.
    """
    explicit = _dedupe_preserve_order(_origins_from_cors_env())
    if explicit:
        return explicit
    if (flask_env or "").strip().lower() == "development":
        return list(_DEV_FALLBACK_ORIGINS)
    raise RuntimeError(
        "CORS_ORIGINS is required when FLASK_ENV is not development. "
        "Set a comma-separated list of exact origins (scheme + host + optional port), "
        "e.g. CORS_ORIGINS=https://your-app.onrender.com,http://localhost:5173"
    )


def init_cors(app: Flask) -> None:
    """
    Register Flask-CORS using ``app.config['CORS_ORIGINS']`` (list of strings).

    Call after ``app.config`` is loaded and ``CORS_ORIGINS`` has been set to
    ``resolve_cors_allowlist(...)``.
    """
    origins = app.config.get("CORS_ORIGINS") or []
    if not isinstance(origins, list):
        origins = list(origins)
    if not origins:
        raise RuntimeError("CORS_ORIGINS config is empty; resolve_cors_allowlist() must run first.")

    CORS(
        app,
        origins=origins,
        methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers="*",
        supports_credentials=True,
        automatic_options=True,
    )
