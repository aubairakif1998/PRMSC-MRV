/**
 * `VITE_API_URL` is the JSON API root (e.g. http://127.0.0.1:5000/api).
 * Static uploads may be served from the same host without the `/api` suffix.
 */
export function getApiOrigin(): string {
  const env = String(import.meta.env.VITE_ENV || "").trim().toUpperCase();
  const fallback =
    env === "PROD" ? "https://prmsc-mrv.vercel.app/api" : "http://127.0.0.1:5001/api";
  const raw = import.meta.env.VITE_API_URL?.trim() || fallback;
  return raw.replace(/\/?api\/?$/i, "") || "http://127.0.0.1:5000";
}

export function uploadsUrl(filename: string): string {
  const name = filename.split(/[/\\]/).pop() || filename;
  return `${getApiOrigin()}/api/uploads/${encodeURIComponent(name)}`;
}
