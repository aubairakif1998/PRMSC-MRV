"""
Vercel Flask entrypoint: expose top-level `app` (see Vercel → Backend → Flask).
Set the Vercel project Root Directory to `backend` so this file is the deployment root.
"""
from app import create_app

app = create_app()
