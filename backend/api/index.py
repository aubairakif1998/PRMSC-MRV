"""
Vercel serverless entry: Flask `app` must live under api/ with rewrites (see backend/vercel.json).
"""
import os
import sys

_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _root not in sys.path:
    sys.path.insert(0, _root)
os.chdir(_root)

from app import create_app  # noqa: E402

app = create_app()
