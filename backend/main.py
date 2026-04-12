"""Vercel zero-config Flask entry: exports ``app`` (see ``wsgi``). Root Directory = ``backend``."""

from wsgi import app

__all__ = ["app"]
