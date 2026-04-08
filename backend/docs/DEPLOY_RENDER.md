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
   | `CORS_ORIGINS` | **Required for browser login:** comma-separated **exact** frontend origins (no trailing slash), e.g. `https://prmsc-mrv-1.onrender.com`. Must include your **Render static site** URL if the API is on another hostname. |
   | `CORS_ALLOW_ONRENDER` | Optional: set `true` to allow any `https://*.onrender.com` origin (easier for many preview URLs; stricter teams rely on `CORS_ORIGINS` only). |
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

If you see **“blocked by CORS policy”** / **“No 'Access-Control-Allow-Origin' header”** on `POST /api/auth/login`, the frontend origin is not allowed. Add it to **`CORS_ORIGINS`** on the API service, redeploy the API, and hard-refresh the site. Example:

`CORS_ORIGINS=https://prmsc-mrv-1.onrender.com`

(Use your real static-site URL from the Render **Static Site** dashboard.)

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
