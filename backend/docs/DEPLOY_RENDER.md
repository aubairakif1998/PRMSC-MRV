# Deploy Flask API on Render (Supabase DB + Storage)

## What was added in this repo

- `wsgi.py` — Gunicorn entrypoint (`wsgi:app`).
- `gunicorn` in `requirements.txt`.
- `render.yaml` at **repository root** — Blueprint with `rootDir: backend`.
- `GET /api/health` — Render health checks (no auth).
- `create_app()` uses `/tmp` for uploads/instance when `RENDER` is set (ephemeral disk).

## One-time: Render service

1. Push this repo to GitHub/GitLab.
2. In [Render](https://dashboard.render.com): **New → Blueprint** → select repo → apply `render.yaml`.
3. In the service **Environment**, set **secret** values (mark as secret in UI):

   | Variable | Notes |
   |----------|--------|
   | `DATABASE_URL` | Supabase **Settings → Database → URI** (direct). `postgres://` is normalized to `postgresql://` in code. |
   | `SECRET_KEY` | Long random string. |
   | `JWT_SECRET_KEY` | Different long random string. |
   | `CORS_ORIGINS` | **Required in production:** comma-separated browser origins (no trailing slash). List every frontend host (e.g. `https://your-static.onrender.com`). See `app/cors.py`. |
   | `SUPABASE_URL` | `https://<project>.supabase.co` |
   | `SUPABASE_STORAGE_BUCKET` | e.g. `mrv-public` |
   | `SUPABASE_S3_ENDPOINT` | Project **Storage → S3** endpoint |
   | `SUPABASE_S3_REGION` | As shown in Supabase |
   | `SUPABASE_S3_ACCESS_KEY_ID` | S3 access key |
   | `SUPABASE_S3_SECRET_ACCESS_KEY` | S3 secret |

4. **Migrations** (after first successful deploy, or via Render **Shell**):

   ```bash
   cd backend && flask db upgrade
   ```

   Ensure `DATABASE_URL` and `FLASK_ENV=production` are available (Render injects env in shell).

5. Open `https://<your-service>.onrender.com/api/health` — expect `{"status":"ok"}`.

## Manual Web Service (no Blueprint)

- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 4 --timeout 120 wsgi:app`

### CORS errors in the browser

Allowed origins are **only** those in **`CORS_ORIGINS`** (env / `.env.production`). If the browser’s `Origin` is missing from that list, add it on the API service, redeploy, and hard-refresh. Example:

`CORS_ORIGINS=https://your-static.onrender.com,http://localhost:5173`

## Frontend / mobile

Point `VITE_API_URL` and the mobile `API_URL` to the Render URL **including** `/api` prefix if your client expects `https://host/api/...` (this app registers routes under `/api/...`).

Example: `https://prmsc-mrv-api.onrender.com` — axios base URL should be `https://prmsc-mrv-api.onrender.com/api` if the client uses paths like `/auth/login` under `apiClient` baseURL.

## Local smoke test (Gunicorn)

```bash
cd backend
export FLASK_ENV=production
export DATABASE_URL="postgresql://..."
pip install -r requirements.txt
gunicorn --bind 127.0.0.1:5001 wsgi:app
curl -s http://127.0.0.1:5001/api/health
```
